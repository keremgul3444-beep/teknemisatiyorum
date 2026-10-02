import type { Prefs } from '@/session/role';
import type { BadgeKind, BoatType, Currency, Equipment } from '@tms/shared';
import { absolute } from '../mode';
import type { AdminItem, AuditEntry, Boat, BrokerCase, Conversation, ExpertiseBooking, ExpertisePackage, Listing, LogEntry, Promo, SavedSearch, Seller } from '../types';

// Sunucu yanıt biçimleri (yalnızca kullanılan alanlar).
export interface ApiListing {
  id: string; brand: string; model: string; year: number; lengthM: number; type: string; price: number; currency: Currency;
  location: string; equipment: string[]; cabins: number; engine: string; description: string; status: string; badges: string[];
  rejectReason?: string | null; photos: { id: string; url: string }[];
  seller: { id: string; name: string | null; since: number; companyName: string | null };
  logbook: { count: number; latest: ApiEntry[]; boatId?: string } | null; isMine: boolean;
  promo?: Promo;
  priceDrop?: { previousPrice: number; at: string } | null;
  webUrl?: string; stats?: { views: number; favorites: number; messages: number };
}
/** Öne çıkarma ürünü (fiyatlar kuruş; site ve uygulama ayrı). */
export interface ApiProduct {
  code: string; kind: 'vitrin' | 'acil' | 'bump'; days: number | null; priceWebKurus: number; priceAppKurus: number;
  iosProductId: string | null; androidProductId: string | null; isTrialPrice: boolean;
}
export interface AdminOrder {
  id: string; listingId: string; listingTitle: string | null; productCode: string; channel: string; amountKurus: number;
  status: string; createdAt: string; paidAt: string | null; note: string | null; userName: string | null;
}
export interface ApiEntry { id: string; kind: LogEntry['kind']; date: string; title: string; byName: string; verified: boolean }
export interface ApiBoat { id: string; name: string; brand: string; model: string; year: number; lengthM: number; entries: ApiEntry[] }
export interface ApiUser { id: string; phone: string | null; name: string | null; email: string | null; lang: string; verifyLevel: number; roles: string[]; nationalIdLast2: string | null; prefs?: Prefs }
export interface ApiConversationRow {
  id: string; subject: { kind: string; id: string; title: string }; otherName: string | null;
  lastMessage: { text: string; at: string; mine: boolean } | null; unread: boolean;
}
export interface ApiThread {
  id: string; subject: ApiConversationRow['subject']; otherName: string | null; otherPhone: string | null; iSharedPhone: boolean;
  messages: { id: string; text: string; at: string; mine: boolean }[];
}

const STATUS: Record<string, Listing['status']> = { published: 'yayinda', sold: 'satildi' };
/** İlanın fotoğraf yoksa prototipteki degrade görsele düşmesi için id'den kararlı bir tohum üretilir. */
const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000;
const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export const toEntry = (e: ApiEntry): LogEntry => ({ id: e.id, kind: e.kind, date: e.date, title: e.title, by: e.byName, verified: e.verified });

export function toListing(l: ApiListing): Listing {
  return {
    id: l.id, brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, price: l.price, currency: l.currency,
    type: l.type as BoatType, location: l.location, equipment: l.equipment as Equipment[], badges: l.badges as BadgeKind[],
    sellerId: l.seller.id, logbookCount: l.logbook?.count ?? 0, description: l.description,
    status: STATUS[l.status] ?? 'onay-bekliyor', rawStatus: l.status, photoSeed: seedOf(l.id), cabins: l.cabins, engine: l.engine,
    photoUrls: l.photos.map((p) => absolute(p.url)), isMine: l.isMine, boatId: l.logbook?.boatId ?? null,
    logbookLatest: l.logbook?.latest.map(toEntry) ?? [], rejectReason: l.rejectReason ?? null,
    promo: l.promo ?? { featured: false, urgent: false },
    priceDrop: l.priceDrop ?? null, webUrl: l.webUrl, stats: l.stats,
  };
}

export const toSeller = (l: ApiListing): Seller => ({ id: l.seller.id, name: l.seller.name ?? '—', since: l.seller.since, companyName: l.seller.companyName });

export const toBoat = (b: ApiBoat): Boat => ({
  id: b.id, name: b.name, brand: b.brand, model: b.model, year: b.year, lengthM: b.lengthM, photoSeed: seedOf(b.id), logbook: b.entries.map(toEntry),
});

const SUBJECT: Record<string, Conversation['subject']['kind']> = { listing: 'ilan', broker: 'broker', expertise: 'broker' };
export const toConversation = (c: ApiConversationRow, prev?: Conversation): Conversation => ({
  id: c.id, withName: c.otherName ?? '—', subject: { kind: SUBJECT[c.subject.kind] ?? 'ilan', id: c.subject.id, title: c.subject.title },
  phoneShared: prev?.phoneShared ?? false, unread: c.unread, messages: prev?.messages ?? [], otherPhone: prev?.otherPhone ?? null,
  preview: c.lastMessage?.text,
});
export const toThread = (t: ApiThread, prev?: Conversation): Conversation => ({
  id: t.id, withName: t.otherName ?? '—', subject: { kind: SUBJECT[t.subject.kind] ?? 'ilan', id: t.subject.id, title: t.subject.title },
  phoneShared: t.iSharedPhone, unread: false, otherPhone: t.otherPhone, preview: prev?.preview,
  messages: t.messages.map((m) => ({ id: m.id, from: m.mine ? 'me' : 'them', text: m.text, at: hm(m.at) })),
});

export const toSaved = (s: { id: string; text: string; createdAt: string; newMatches: number }): SavedSearch =>
  ({ id: s.id, query: s.text, createdAt: s.createdAt.slice(0, 10), newMatches: s.newMatches });
export const toPackage = (p: { id: string; name: string; priceTry: number; items: string[] }): ExpertisePackage =>
  ({ id: p.id, name: p.name, priceTRY: p.priceTry, items: p.items });
export const toBooking = (b: { id: string; packageId: string; listingId: string | null; date: string; slot: string; reportStatus: string; score: number | null }): ExpertiseBooking =>
  ({ id: b.id, packageId: b.packageId, listingId: b.listingId ?? undefined, date: b.date, slot: b.slot, reportStatus: b.reportStatus, score: b.score });
export const toBroker = (c: { id: string; boatName: string; step: number; askingPrice: number; currency: Currency; createdAt: string }): BrokerCase =>
  ({ id: c.id, boatName: c.boatName, step: c.step as BrokerCase['step'], askingEUR: c.currency === 'EUR' ? c.askingPrice : 0, createdAt: c.createdAt.slice(0, 10) });

export const toAdminListing = (x: { id: string; title: string; ownerName: string | null; photos?: string[] }): AdminItem =>
  ({ id: `l:${x.id}`, kind: 'ilan', title: x.title, who: x.ownerName ?? '—', status: 'bekliyor', refId: x.id, photos: (x.photos ?? []).map(absolute) });
export const toAdminVerification = (x: { id: string; kind: string; userName: string | null; fileIds?: string[]; details?: Record<string, unknown> | null }): AdminItem =>
  ({ id: `v:${x.id}`, kind: 'belge', title: x.kind, who: x.userName ?? '—', status: 'bekliyor', refId: x.id, fileIds: x.fileIds ?? [], details: x.details ?? null });
export const toAudit = (a: { id: string; at: string; actorId: string | null; action: string; params: Record<string, string> | null }): AuditEntry =>
  ({ id: a.id, at: a.at.slice(0, 16).replace('T', ' '), who: a.actorId ?? '—', key: a.action, params: a.params ?? undefined });
