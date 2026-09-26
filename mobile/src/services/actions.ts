import { Platform } from 'react-native';
import { matchListings, parseQuery, parsedQuerySchema, type Criterion, type ParsedQuery } from '@tms/shared';
import { useStore } from './store';
import { isApiMode } from './mode';
import { api } from './api/instance';
import { applyUser, syncAdmin, syncAll, syncListings, syncMine } from './api/sync';
import { toBoat, toListing, toThread, type ApiBoat, type ApiListing, type ApiThread, type ApiUser } from './api/mappers';
import type { AdminStatus, BoatInput, Listing, ListingDraft, SubjectKind } from './types';
import { useSession } from '@/session/role';

const g = () => useStore.getState();
const SUBJECT_TO_API: Partial<Record<SubjectKind, string>> = { ilan: 'listing', broker: 'broker' };

export interface AssistantResult { query: ParsedQuery; exact: Listing[]; near: { listing: Listing; missing: Criterion[] }[]; source: 'llm' | 'rules' | 'local' }

/** Tek fotoğrafı/belgeyi sunucuya yükler; dönen dosya kimliği ilana ya da başvuruya eklenir. */
async function upload(uri: string, visibility: 'public' | 'private'): Promise<string> {
  const form = new FormData();
  form.append('visibility', visibility);
  if (Platform.OS === 'web') form.append('file', await (await fetch(uri)).blob(), 'photo.jpg');
  else form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  return (await api.upload<{ id: string }>('/media', form)).id;
}

/**
 * Ekranların tek eylem kapısı. Demo modunda prototipin yerel deposu, gerçek modda sunucu kullanılır;
 * her eylem iki modda da Promise döndürür, ekranlar `await` eder.
 */
export const actions = {
  // ——— Giriş ve doğrulama ———
  async requestOtp(phone: string) {
    if (isApiMode()) await api.post('/auth/otp', { phone });
  },
  async verifyOtp(phone: string, code: string, deviceName = 'Telefon') {
    if (!isApiMode()) {
      const s = useSession.getState();
      s.login();
      return;
    }
    const r = await api.post<{ accessToken: string; refreshToken: string; user: ApiUser }>('/auth/verify', { phone, code, deviceName });
    await api.setTokens(r.accessToken, r.refreshToken);
    applyUser(r.user);
    await syncMine();
    await syncAdmin();
  },
  async verifyIdentity(input: { tckn: string; firstName: string; lastName: string; birthYear: number } | { passport: string; nationality: string; firstName: string; lastName: string; birthYear: number; fileUri: string }) {
    if (!isApiMode()) {
      const s = useSession.getState();
      s.login();
      if ('tckn' in input) s.setVerifyLevel(Math.max(2, s.verifyLevel) as 2);
      return { pending: !('tckn' in input) };
    }
    const body = 'tckn' in input ? input : { ...input, fileUri: undefined, fileId: await upload(input.fileUri, 'private') };
    const u = await api.post<ApiUser>('/verification/identity', body);
    applyUser(u);
    return { pending: u.verifyLevel < 2 };
  },
  async submitProfessional(kind: 'usta' | 'kaptan' | 'eksper' | 'firma', fileUris: string[]) {
    if (!isApiMode()) {
      useSession.getState().setVerifyLevel(3);
      return;
    }
    const fileIds = await Promise.all(fileUris.map((u) => upload(u, 'private')));
    await api.post('/verification/requests', { kind, fileIds });
  },
  async logout() {
    if (isApiMode()) {
      await api.post('/auth/logout').catch(() => undefined);
      await api.logoutLocal();
      await syncAll();
    }
    useSession.getState().logout();
  },
  async deleteAccount() {
    if (isApiMode()) {
      await api.del('/me');
      await api.logoutLocal();
    }
    useSession.getState().logout();
  },

  // ——— İlanlar ———
  async createListing(d: ListingDraft, extra: { photoUris?: string[]; broker?: boolean; ownershipUri?: string } = {}) {
    if (!isApiMode()) {
      const id = g().createListing(d);
      if (extra.broker) g().applyBroker({ boatName: `${d.brand} ${d.model}`, askingEUR: d.currency === 'EUR' ? d.price : 0 });
      return id;
    }
    const l = await api.post<ApiListing>('/listings', d);
    const fileIds = await Promise.all((extra.photoUris ?? []).map((u) => upload(u, 'public')));
    if (fileIds.length) await api.post(`/listings/${l.id}/photos`, { fileIds });
    await api.post(`/listings/${l.id}/submit`);
    if (extra.ownershipUri) await api.post('/verification/requests', { kind: 'ruhsat', fileIds: [await upload(extra.ownershipUri, 'private')], listingId: l.id });
    if (extra.broker) await api.post('/broker/cases', { boatName: `${d.brand} ${d.model}`, askingPrice: d.price, currency: d.currency });
    await syncMine();
    return l.id;
  },
  async loadListing(id: string) {
    if (!isApiMode()) return;
    const l = await api.get<ApiListing>(`/listings/${id}`);
    useStore.setState({ listings: [...g().listings.filter((x) => x.id !== id), toListing(l)] });
  },
  async toggleFavorite(id: string) {
    if (!isApiMode()) return g().toggleFavorite(id);
    const on = g().favorites.includes(id);
    await (on ? api.del(`/favorites/${id}`) : api.put(`/favorites/${id}`));
    useStore.setState({ favorites: on ? g().favorites.filter((x) => x !== id) : [id, ...g().favorites] });
  },
  async saveSearch(text: string, filter?: ParsedQuery) {
    if (!isApiMode()) return void g().saveSearch(text);
    await api.post('/saved-searches', { text, filter: parsedQuerySchema.parse(filter ?? parseQuery(text)) });
    await syncMine();
  },
  async assistantSearch(text: string): Promise<AssistantResult> {
    if (!isApiMode()) {
      const query = parseQuery(text);
      return { query, ...matchListings(g().listings, query), source: 'local' };
    }
    const r = await api.post<{ query: ParsedQuery; source: 'llm' | 'rules'; exact: ApiListing[]; near: { listing: ApiListing; missing: Criterion[] }[] }>('/assistant/search', { text });
    return { query: r.query, source: r.source, exact: r.exact.map(toListing), near: r.near.map((n) => ({ listing: toListing(n.listing), missing: n.missing })) };
  },
  async refresh() {
    if (isApiMode()) await Promise.all([syncListings(), syncMine(), syncAdmin()]);
  },

  // ——— Tekneler ———
  async addBoat(input: BoatInput) {
    if (!isApiMode()) return g().addBoat(input);
    const b = await api.post<ApiBoat>('/boats', input);
    useStore.setState({ boats: [...g().boats, toBoat(b)] });
    return b.id;
  },

  // ——— Mesajlar ———
  async startConversation(subject: { kind: SubjectKind; id: string; title: string }, withName: string) {
    if (!isApiMode()) return g().startConversation(subject, withName);
    const r = await api.post<{ id: string }>('/conversations', { subjectKind: SUBJECT_TO_API[subject.kind] ?? 'listing', subjectId: subject.id });
    await actions.openConversation(r.id);
    return r.id;
  },
  async openConversation(id: string) {
    if (!isApiMode()) return g().markRead(id);
    const t = await api.get<ApiThread>(`/conversations/${id}/messages`);
    await api.post(`/conversations/${id}/read`);
    const prev = g().conversations.find((c) => c.id === id);
    useStore.setState({ conversations: [toThread(t, prev), ...g().conversations.filter((c) => c.id !== id)] });
  },
  async sendMessage(convId: string, text: string) {
    if (!isApiMode()) return g().sendMessage(convId, text);
    await api.post(`/conversations/${convId}/messages`, { text });
    await actions.openConversation(convId);
  },
  async sharePhone(convId: string) {
    if (!isApiMode()) return g().sharePhone(convId);
    await api.post(`/conversations/${convId}/share-phone`);
    await actions.openConversation(convId);
  },

  // ——— Ekspertiz ve broker ———
  async bookExpertise(input: { packageId: string; listingId?: string; date: string; slot: string }) {
    if (!isApiMode()) return g().bookExpertise(input);
    const r = await api.post<{ id: string }>('/expertise/bookings', input);
    await syncMine();
    return r.id;
  },
  async applyBroker(input: { boatName: string; askingEUR: number }) {
    if (!isApiMode()) return g().applyBroker(input);
    const r = await api.post<{ id: string }>('/broker/cases', { boatName: input.boatName, askingPrice: input.askingEUR, currency: 'EUR' });
    await syncMine();
    return r.id;
  },

  // ——— Yönetim ———
  async setAdminStatus(itemId: string, status: AdminStatus) {
    if (!isApiMode()) return g().setAdminStatus(itemId, status);
    const item = g().adminItems.find((a) => a.id === itemId);
    if (!item?.refId) return;
    const body = status === 'onaylandi' ? { decision: 'approve' } : { decision: 'reject', reason: 'rules' };
    await api.post(item.kind === 'ilan' ? `/admin/listings/${item.refId}/decision` : `/admin/verifications/${item.refId}/decision`, body);
    await Promise.all([syncAdmin(), syncListings()]);
  },
  async advanceBroker(id: string) {
    if (!isApiMode()) return g().advanceBroker(id);
    await api.post(`/admin/broker/${id}/advance`);
    await syncMine();
  },

  // ——— Yalnızca demo (2. dalga: usta, kaptan, ödeme) ———
  createJob: async (...a: Parameters<ReturnType<typeof g>['createJob']>) => g().createJob(...a),
  acceptOffer: async (jobId: string, offerId: string) => g().acceptOffer(jobId, offerId),
  payJob: async (jobId: string) => g().payJob(jobId),
  completeJob: async (jobId: string) => g().completeJob(jobId),
  rateJob: async (jobId: string, stars: number) => g().rateJob(jobId, stars),
  bookCaptain: async (...a: Parameters<ReturnType<typeof g>['bookCaptain']>) => g().bookCaptain(...a),
  payCaptain: async (id: string) => g().payCaptain(id),
  /** Demo sohbetinde karşı tarafın otomatik yanıtı. */
  demoReply: (convId: string, text: string) => { if (!isApiMode()) g().sendMessage(convId, text, 'them'); },
  markRead: async (convId: string) => (isApiMode() ? actions.openConversation(convId) : g().markRead(convId)),
  resetDemo: async () => g().resetDemo(),
};
