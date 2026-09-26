import { useStore } from '../store';
import { api } from './instance';
import { ApiError } from './client';
import { setRates, type Rates } from '../rates';
import {
  toAdminListing, toAdminVerification, toAudit, toBoat, toBooking, toBroker, toConversation, toListing, toPackage, toSaved, toSeller,
  type ApiBoat, type ApiConversationRow, type ApiListing, type ApiUser,
} from './mappers';
import { DEFAULT_PREFS, useSession } from '@/session/role';
import type { Role } from '../types';

const set = (patch: Partial<ReturnType<typeof useStore.getState>>) => useStore.setState(patch);

/** Sunucudaki kullanıcıyı uygulama oturumuna yansıtır. */
export function applyUser(u: ApiUser) {
  const staff = u.roles.includes('admin') || u.roles.includes('moderator');
  const s = useSession.getState();
  useSession.setState({
    loggedIn: true, verifyLevel: Math.min(3, u.verifyLevel) as 0 | 1 | 2 | 3, name: u.name ?? '',
    role: staff ? 'yonetici' : (s.role === 'yonetici' ? 'bireysel' : s.role) as Role, userId: u.id, staff,
    prefs: { ...DEFAULT_PREFS, ...u.prefs },
  });
}

/** İlanları ve satıcıları depoya yazar; kendi ilanları (onay bekleyen/taslak dahil) herkese açık listeyle birleşir. */
function putListings(rows: ApiListing[]) {
  const byId = new Map(useStore.getState().listings.map((l) => [l.id, l]));
  rows.forEach((r) => byId.set(r.id, toListing(r)));
  const sellers = new Map(useStore.getState().sellers.map((x) => [x.id, x]));
  rows.forEach((r) => sellers.set(r.seller.id, toSeller(r)));
  set({ listings: [...byId.values()], sellers: [...sellers.values()] });
}

export async function syncListings() {
  const all: ApiListing[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await api.get<{ items: ApiListing[]; total: number }>(`/listings?page=${page}`);
    all.push(...r.items);
    if (all.length >= r.total || r.items.length === 0) break;
  }
  set({ listings: [], sellers: [] });
  putListings(all);
}

export async function syncMine() {
  if (!useSession.getState().loggedIn) return;
  const [mine, favs, saved, boats, convs, bookings, broker] = await Promise.all([
    api.get<ApiListing[]>('/me/listings'),
    api.get<ApiListing[]>('/favorites'),
    api.get<{ id: string; text: string; createdAt: string; newMatches: number }[]>('/saved-searches'),
    api.get<ApiBoat[]>('/boats'),
    api.get<ApiConversationRow[]>('/conversations'),
    api.get<Parameters<typeof toBooking>[0][]>('/me/expertise'),
    api.get<Parameters<typeof toBroker>[0][]>('/me/broker'),
  ]);
  putListings([...mine, ...favs]);
  const prev = new Map(useStore.getState().conversations.map((c) => [c.id, c]));
  set({
    favorites: favs.map((f) => f.id),
    savedSearches: saved.map(toSaved),
    boats: boats.map(toBoat),
    conversations: convs.map((c) => toConversation(c, prev.get(c.id))),
    expertiseBookings: bookings.map(toBooking),
    brokerCases: broker.map(toBroker),
  });
}

export async function syncAdmin() {
  if (!useSession.getState().staff) return;
  const [listings, verifications, audit] = await Promise.all([
    api.get<Parameters<typeof toAdminListing>[0][]>('/admin/queue?kind=listing'),
    api.get<Parameters<typeof toAdminVerification>[0][]>('/admin/queue?kind=verification'),
    api.get<Parameters<typeof toAudit>[0][]>('/admin/audit'),
  ]);
  set({ adminItems: [...listings.map(toAdminListing), ...verifications.map(toAdminVerification)], audit: audit.map(toAudit) });
}

/**
 * Gerçek moda geçişte ya da girişten sonra: sahte veriyi boşaltır, sunucudan yükler.
 * Usta/kaptan/ödeme (2. dalga) dilimleri boş kalır; o ekranlar gerçek modda "yakında" gösterir.
 */
export async function syncAll() {
  set({ jobs: [], captainBookings: [], providers: [], companies: [] });
  if (await api.hasSession()) {
    try {
      applyUser(await api.get<ApiUser>('/me'));
    } catch (e) {
      // Oturum düşmüşse (401) istemci çıkışı kendisi yapar, misafir olarak sürer; diğer hatalar kullanıcıya gösterilir.
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
  }
  setRates(await api.get<Rates>('/fx'));
  const pk = await api.get<Parameters<typeof toPackage>[0][]>('/expertise/packages');
  set({ expertisePackages: pk.map(toPackage), favorites: [], savedSearches: [], boats: [], conversations: [], expertiseBookings: [], brokerCases: [], adminItems: [], audit: [] });
  await syncListings();
  await syncMine();
  await syncAdmin();
}
