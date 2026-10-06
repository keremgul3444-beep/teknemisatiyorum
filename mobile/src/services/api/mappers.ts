import type { Prefs } from '@/session/role';
import type { BadgeKind, BoatType, Currency, Equipment, Flag, ParsedQuery } from '@tms/shared';
import { absolute } from '../mode';
import type { AdminItem, AuditEntry, Boat, BrokerCase, CaptainBooking, Conversation, ExpertiseBooking, ExpertisePackage, Job, Listing, LogEntry, Promo, Provider, SavedSearch, Seller } from '../types';

// Sunucu yanıt biçimleri (yalnızca kullanılan alanlar).
export interface ApiListing {
  id: string; brand: string; model: string; year: number; lengthM: number; type: string; price: number; currency: Currency;
  location: string; equipment: string[]; cabins: number; engine: string; description: string; descriptionEn?: string | null; videoUrl?: string | null; status: string; badges: string[];
  engineHours?: number | null; flag?: string | null; tradeIn?: boolean; negotiable?: boolean;
  rejectReason?: string | null; rejectNote?: string | null; pendingEdit?: boolean; removedReason?: string | null; expiresAt?: string | null; photos: { id: string; url: string }[];
  seller: { id: string; name: string | null; since: number; companyName: string | null; verified?: boolean };
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
  id: string; subject: ApiConversationRow['subject']; otherName: string | null; otherPhone: string | null; iSharedPhone: boolean; blocked?: 'me' | 'them' | null;
  messages: { id: string; text: string; at: string; mine: boolean }[];
}

const STATUS: Record<string, Listing['status']> = { published: 'yayinda', sold: 'satildi', rejected: 'reddedildi', removed: 'kaldirildi', expired: 'suresi-doldu' };
/** İlanın fotoğraf yoksa prototipteki degrade görsele düşmesi için id'den kararlı bir tohum üretilir. */
const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000;
const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export const toEntry = (e: ApiEntry): LogEntry => ({ id: e.id, kind: e.kind, date: e.date, title: e.title, by: e.byName, verified: e.verified });

export function toListing(l: ApiListing): Listing {
  return {
    id: l.id, brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, price: l.price, currency: l.currency,
    type: l.type as BoatType, location: l.location, equipment: l.equipment as Equipment[], badges: l.badges as BadgeKind[],
    sellerId: l.seller.id, logbookCount: l.logbook?.count ?? 0, description: l.description, descriptionEn: l.descriptionEn ?? null, videoUrl: l.videoUrl ?? null,
    status: STATUS[l.status] ?? 'onay-bekliyor', rawStatus: l.status, photoSeed: seedOf(l.id), cabins: l.cabins, engine: l.engine,
    photoUrls: l.photos.map((p) => absolute(p.url)), photoIds: l.photos.map((p) => p.id), isMine: l.isMine, boatId: l.logbook?.boatId ?? null,
    logbookLatest: l.logbook?.latest.map(toEntry) ?? [], rejectReason: l.rejectReason ?? null, rejectNote: l.rejectNote ?? null, pendingEdit: !!l.pendingEdit,
    removedReason: (l.removedReason as Listing['removedReason']) ?? null, expiresAt: l.expiresAt ?? null,
    promo: l.promo ?? { featured: false, urgent: false },
    priceDrop: l.priceDrop ?? null, webUrl: l.webUrl, stats: l.stats,
    engineHours: l.engineHours ?? null, flag: (l.flag as Flag | null | undefined) ?? null, tradeIn: !!l.tradeIn, negotiable: !!l.negotiable,
  };
}

export const toSeller = (l: ApiListing): Seller => ({ id: l.seller.id, name: l.seller.name ?? '—', since: l.seller.since, companyName: l.seller.companyName, verified: !!l.seller.verified });

export const toBoat = (b: ApiBoat): Boat => ({
  id: b.id, name: b.name, brand: b.brand, model: b.model, year: b.year, lengthM: b.lengthM, photoSeed: seedOf(b.id), logbook: b.entries.map(toEntry),
});

const SUBJECT: Record<string, Conversation['subject']['kind']> = { listing: 'ilan', broker: 'broker', expertise: 'broker', job: 'is', captain: 'kaptan', provider: 'kaptan' };
export const toConversation = (c: ApiConversationRow, prev?: Conversation): Conversation => ({
  id: c.id, withName: c.otherName ?? '—', subject: { kind: SUBJECT[c.subject.kind] ?? 'ilan', id: c.subject.id, title: c.subject.title },
  phoneShared: prev?.phoneShared ?? false, unread: c.unread, messages: prev?.messages ?? [], otherPhone: prev?.otherPhone ?? null,
  preview: c.lastMessage?.text,
});
export const toThread = (t: ApiThread, prev?: Conversation): Conversation => ({
  id: t.id, withName: t.otherName ?? '—', subject: { kind: SUBJECT[t.subject.kind] ?? 'ilan', id: t.subject.id, title: t.subject.title },
  phoneShared: t.iSharedPhone, unread: false, otherPhone: t.otherPhone, preview: prev?.preview, blocked: t.blocked ?? null,
  messages: t.messages.map((m) => ({ id: m.id, from: m.mine ? 'me' : 'them', text: m.text, at: hm(m.at) })),
});

export const toSaved = (s: { id: string; text: string; createdAt: string; newMatches: number; filter?: ParsedQuery }): SavedSearch =>
  ({ id: s.id, query: s.text, createdAt: s.createdAt.slice(0, 10), newMatches: s.newMatches, filter: s.filter });
export const toPackage = (p: { id: string; name: string; priceTry: number; items: string[] }): ExpertisePackage =>
  ({ id: p.id, name: p.name, priceTRY: p.priceTry, items: p.items });
export const toBooking = (b: { id: string; packageId: string; listingId: string | null; date: string; slot: string; reportStatus: string; score: number | null }): ExpertiseBooking =>
  ({ id: b.id, packageId: b.packageId, listingId: b.listingId ?? undefined, date: b.date, slot: b.slot, reportStatus: b.reportStatus, score: b.score });
export const toBroker = (c: { id: string; boatName: string; step: number; askingPrice: number; currency: Currency; createdAt: string }): BrokerCase =>
  ({ id: c.id, boatName: c.boatName, step: c.step as BrokerCase['step'], askingEUR: c.currency === 'EUR' ? c.askingPrice : 0, createdAt: c.createdAt.slice(0, 10) });

export interface ApiAdminListing {
  id: string; title: string; ownerName: string | null; photos?: string[]; version?: string; ownerVerifyLevel?: number;
  year?: number; price?: number; currency?: Currency; lengthM?: number; type?: string; location?: string; cabins?: number; engine?: string;
  engineHours?: number | null; flag?: string | null; tradeIn?: boolean; negotiable?: boolean; equipment?: string[]; description?: string;
  previousRejectReason?: string | null;
  photoDuplicates?: { listingId: string; title: string; status: string; sameOwner: boolean }[];
}
export const toAdminListing = (x: ApiAdminListing): AdminItem => ({
  id: `l:${x.id}`, kind: 'ilan', title: x.title, who: x.ownerName ?? '—', status: 'bekliyor', refId: x.id, photos: (x.photos ?? []).map(absolute),
  version: x.version,
  listing: x.year === undefined ? undefined : {
    year: x.year, price: x.price ?? 0, currency: x.currency ?? 'EUR', lengthM: x.lengthM ?? 0, type: (x.type ?? 'motoryat') as BoatType,
    location: x.location ?? '', cabins: x.cabins ?? 0, engine: x.engine ?? '', engineHours: x.engineHours ?? null,
    flag: (x.flag as Flag | null | undefined) ?? null, tradeIn: !!x.tradeIn, negotiable: !!x.negotiable,
    equipment: (x.equipment ?? []) as Equipment[], description: x.description ?? '', ownerVerifyLevel: x.ownerVerifyLevel ?? 0,
    previousRejectReason: x.previousRejectReason ?? null, photoDuplicates: x.photoDuplicates ?? [],
  },
});
export const toAdminVerification = (x: { id: string; kind: string; userName: string | null; fileIds?: string[]; details?: Record<string, unknown> | null }): AdminItem =>
  ({ id: `v:${x.id}`, kind: 'belge', title: x.kind, who: x.userName ?? '—', status: 'bekliyor', refId: x.id, fileIds: x.fileIds ?? [], details: x.details ?? null });
export const toAudit = (a: { id: string; at: string; actorId: string | null; action: string; params: Record<string, string> | null }): AuditEntry =>
  ({ id: a.id, at: a.at.slice(0, 16).replace('T', ' '), who: a.actorId ?? '—', key: a.action, params: a.params ?? undefined });

// ——— 2. dalga: hizmet verenler, işler, kaptan rezervasyonları ———

export interface ApiProvider {
  id: string; kind: 'usta' | 'kaptan'; name: string; categories: string[]; region: string; bio: string; priceNote: string; yearsExp: number;
  languages: string[]; areas: string[]; dayRateEur: number | null; weekRateEur: number | null; rating: number | null; reviewCount: number; verified: boolean;
  status?: 'pending' | 'active' | 'suspended';
}
export const toProvider = (p: ApiProvider): Provider => ({
  id: p.id, kind: p.kind, name: p.name, categories: p.categories as Provider['categories'], rating: p.rating ?? 0, reviewCount: p.reviewCount,
  region: p.region, verified: p.verified, docs: [], priceNote: p.priceNote, bio: p.bio, yearsExp: p.yearsExp,
  dayRateEUR: p.dayRateEur ?? undefined, weekRateEUR: p.weekRateEur ?? (p.dayRateEur ? p.dayRateEur * 6 : undefined), languages: p.languages, areas: p.areas,
});

export interface ApiJob {
  id: string; category: string; title: string; description: string; region: string; boatId?: string | null;
  status: 'open' | 'accepted' | 'paid' | 'done' | 'cancelled'; acceptedQuoteId: string | null; createdAt: string;
  quotes: { id: string; priceTry: number; days: number; note: string; provider: ApiProvider }[];
  paymentStatus?: string | null; reviewed?: boolean; deliveredAt?: string | null; autoReleaseAt?: string | null; disputed?: boolean;
}
/** Sunucu durumu → uygulamadaki adım: teklif gelmemiş açık iş "talep", teklif varsa "teklif". */
export function jobStatusOf(j: Pick<ApiJob, 'status' | 'quotes' | 'reviewed'>): Job['status'] {
  switch (j.status) {
    case 'open': return j.quotes.length ? 'teklif' : 'talep';
    case 'accepted': return 'onay';
    case 'paid': return 'devam';
    case 'done': return j.reviewed ? 'degerlendirildi' : 'tamam';
    default: return 'iptal';
  }
}
export const toJob = (j: ApiJob): Job => ({
  id: j.id, category: j.category as Job['category'], title: j.title, description: j.description, boatId: j.boatId ?? '',
  status: jobStatusOf(j), acceptedOfferId: j.acceptedQuoteId ?? undefined, createdAt: j.createdAt.slice(0, 10),
  paid: j.paymentStatus === 'held' || j.paymentStatus === 'released',
  offers: j.quotes.map((q) => ({ id: q.id, providerId: q.provider.id, priceTRY: q.priceTry, days: q.days, note: q.note })),
  deliveredAt: j.deliveredAt ?? null, autoReleaseAt: j.autoReleaseAt ?? null, disputed: !!j.disputed,
});

export interface ApiCaptainBooking {
  id: string; start: string; days: number; totalEur: number; status: 'requested' | 'accepted' | 'paid' | 'done' | 'cancelled'; captain: ApiProvider; reviewed?: boolean;
  autoReleaseAt?: string | null; disputed?: boolean;
}
export const toCaptainBooking = (b: ApiCaptainBooking): CaptainBooking => ({
  id: b.id, captainId: b.captain.id, start: b.start, days: b.days, totalEUR: b.totalEur, paid: b.status === 'paid' || b.status === 'done', status: b.status, reviewed: b.reviewed,
  autoReleaseAt: b.autoReleaseAt ?? null, disputed: !!b.disputed,
});
