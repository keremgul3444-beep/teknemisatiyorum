import { Linking, Platform, Share } from 'react-native';
import { matchListings, parseQuery, parsedQuerySchema, type Criterion, type ParsedQuery } from '@tms/shared';
import { useStore } from './store';
import { absolute, isApiMode } from './mode';
import { api } from './api/instance';
import { applyUser, syncAdmin, syncAll, syncListings, syncMine } from './api/sync';
import { toBoat, toListing, toThread, type AdminOrder, type ApiBoat, type ApiListing, type ApiProduct, type ApiThread, type ApiUser } from './api/mappers';
import { ApiError } from './api/client';
import { devReceipt } from '@/features/promo';
import type { AdminStatus, BoatInput, Listing, ListingDraft, SubjectKind } from './types';
import { useSession, type Prefs } from '@/session/role';
import { resetRates } from './rates';
import { createPublisher, type PublishExtra } from '@/features/publishListing';
import { clearAllListingDrafts } from '@/features/listingDraftStore';
import { getPushToken } from '@/features/push';

/** Bu cihazın sunucuya bıraktığı bildirim jetonu; çıkışta silinir. */
let pushToken: string | null = null;

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

/** İlan gönderimi yarıda kalırsa yeniden denemede kaldığı yerden sürer (yeni taslak açılmaz). */
const publishListing = createPublisher({ post: (p, b) => api.post(p, b), patch: (p, b) => api.patch(p, b), upload });
// Hesap değişince (çıkış, başka kullanıcıyla giriş) yarım kalan ilan gönderimi unutulur.
useSession.subscribe((s, prev) => { if (s.userId !== prev.userId || s.loggedIn !== prev.loggedIn) publishListing.reset(); });

/**
 * Ekranların tek eylem kapısı. Demo modunda prototipin yerel deposu, gerçek modda sunucu kullanılır;
 * her eylem iki modda da Promise döndürür, ekranlar `await` eder.
 */
export const actions = {
  // ——— Giriş ve doğrulama ———
  /** Kapalı betada sunucu kodu yanıtta döndürebilir (SMS yokken); dönerse ekran kodu kendisi doldurur. */
  async requestOtp(phone: string): Promise<string | undefined> {
    if (!isApiMode()) return undefined;
    const r = await api.post<{ devCode?: string } | undefined>('/auth/otp', { phone });
    return r?.devCode;
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
    await actions.registerPush();
  },
  /** Giriş sonrası ve her açılışta: izin varsa cihaz jetonu sunucuya bırakılır (sessizce; hata giriş akışını bozmaz). */
  async registerPush() {
    if (!isApiMode() || !useSession.getState().loggedIn) return;
    const t = await getPushToken();
    if (!t) return;
    pushToken = t.token;
    await api.put('/me/push-token', t).catch(() => undefined);
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
    await clearAllListingDrafts();
    if (!isApiMode()) return useSession.getState().logout();
    // Çıkan hesaba bu telefona bildirim gelmesin.
    if (pushToken) { await api.del(`/me/push-token/${encodeURIComponent(pushToken)}`).catch(() => undefined); pushToken = null; }
    await api.post('/auth/logout').catch(() => undefined);
    await api.logoutLocal();
    // Ekran önce çıkışa geçer; misafir verisinin yüklenmesi ağ hatası verse bile oturum açık görünmez.
    useSession.getState().logout();
    await syncAll();
  },
  async deleteAccount() {
    await clearAllListingDrafts();
    if (isApiMode()) {
      await api.del('/me');
      await api.logoutLocal();
    }
    useSession.getState().logout();
  },

  // ——— İlanlar ———
  async createListing(d: ListingDraft, extra: PublishExtra = {}) {
    if (!isApiMode()) {
      const id = g().createListing(d);
      if (extra.broker) g().applyBroker({ boatName: `${d.brand} ${d.model}`, askingEUR: d.currency === 'EUR' ? d.price : 0 });
      return id;
    }
    const id = await publishListing(d, extra);
    await syncMine();
    return id;
  },
  /** Devir asistanının sonunda: ilan satıldı (yayından kalkar, İlanlarım > Satıldı'da durur). */
  async markSold(id: string) {
    if (!isApiMode()) return g().markSold(id);
    await api.post(`/listings/${id}/sold`);
    await syncMine();
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

  /** Korumalı belgeyi (kimlik, ruhsat) 5 dakikalık imzalı bağlantıyla açar — yalnızca sahibi ya da ekip. */
  async openDocument(fileId: string) {
    const r = await api.get<{ url: string }>(`/media/${fileId}/signed`);
    await Linking.openURL(absolute(r.url));
  },
  async adminBrokerCases() {
    return api.get<{ id: string; boatName: string; step: number; askingPrice: number; currency: string; userName: string | null }[]>('/admin/broker');
  },
  async adminExpertise() {
    return api.get<{ id: string; date: string; slot: string; reportStatus: string; score: number | null; packageName: string | null; userName: string | null }[]>('/admin/expertise');
  },
  async adminAdvanceBroker(id: string) {
    await api.post(`/admin/broker/${id}/advance`);
  },
  async adminReport(id: string, score: number) {
    await api.post(`/admin/expertise/${id}/report`, { score });
  },
  /** Dil ve tercihler sunucuda saklanır (başka cihazda da geçerli); demo modunda yalnızca yerel. */
  async updateProfile(patch: { lang?: 'tr' | 'en'; prefs?: Partial<Prefs> }) {
    if (!isApiMode() || !useSession.getState().loggedIn) {
      if (patch.prefs) {
        const next = { ...useSession.getState().prefs, ...patch.prefs };
        if (!next.marketingConsent) next.notifyMarketing = false; // sunucudaki kuralın aynısı
        useSession.setState({ prefs: next });
      }
      return;
    }
    applyUser(await api.patch<ApiUser>('/me', patch));
  },
  /** KVKK: kişisel verinin kopyası. Web'de dosya olarak iner, telefonda paylaşım menüsü açılır. */
  async exportData(): Promise<boolean> {
    if (!isApiMode()) return false;
    const data = await api.get<unknown>('/me/export');
    const json = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'verilerim.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } else await Share.share({ title: 'verilerim.json', message: json });
    return true;
  },
  async notifications() {
    return api.get<{ id: string; key: string; params: Record<string, string> | null; readAt: string | null; createdAt: string }[]>('/notifications');
  },
  async readNotification(id: string) {
    await api.post(`/notifications/${id}/read`);
  },
  // ——— Öne çıkarma ———
  async products(): Promise<ApiProduct[]> {
    if (!isApiMode()) return [];
    return api.get<ApiProduct[]>('/products');
  },
  /** Uygulama içi satın alma. Bu turda mağaza modülü yok: deneme makbuzu (sunucu yalnızca deneme modunda kabul eder). */
  async buyInApp(listingId: string, p: ApiProduct) {
    const platform = Platform.OS === 'android' ? 'android' : 'ios';
    const storeId = platform === 'ios' ? p.iosProductId : p.androidProductId;
    if (!storeId) throw new ApiError(400, 'BAD_RECEIPT', 'errors.bad_receipt');
    await api.post('/orders/store', { listingId, platform, receipt: devReceipt(storeId) });
    await syncMine();
  },
  /** Ana sayfa vitrin ve acil şeritleri. */
  async showcase(): Promise<{ featured: Listing[]; urgent: Listing[] }> {
    if (!isApiMode()) return { featured: g().listings.filter((l) => l.promo?.featured), urgent: g().listings.filter((l) => l.promo?.urgent) };
    const r = await api.get<{ featured: ApiListing[]; urgent: ApiListing[] }>('/listings/showcase');
    return { featured: r.featured.map(toListing), urgent: r.urgent.map(toListing) };
  },
  adminOrders: (status?: string) => api.get<AdminOrder[]>(`/admin/orders${status ? `?status=${status}` : ''}`),
  adminManualOrder: (listingId: string, productCode: string, note: string) => api.post('/admin/orders/manual', { listingId, productCode, note }),
  adminRefund: (orderId: string) => api.post(`/admin/orders/${orderId}/refund`),
  adminSetPrice: (code: string, patch: { priceWebKurus?: number; priceAppKurus?: number }) => api.put(`/admin/products/${code}`, patch),

  async sessions() {
    return api.get<{ id: string; deviceName: string; lastSeenAt: string; current: boolean }[]>('/auth/sessions');
  },
  async revokeSession(id: string) {
    await api.del(`/auth/sessions/${id}`);
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
  resetDemo: async () => { resetRates(); g().resetDemo(); },
};
