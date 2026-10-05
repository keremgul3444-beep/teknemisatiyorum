import type { BadgeKind, BoatType, Currency, Equipment, Flag, ListingStatus, ReportReason, TakedownReason, UstaCategory } from '@tms/shared';
export type { BadgeKind, BoatType, Currency, Equipment, ListingStatus, UstaCategory } from '@tms/shared';
export { USTA_CATEGORIES } from '@tms/shared';


export interface Listing {
  id: string; brand: string; model: string; year: number; lengthM: number; price: number; currency: Currency;
  type: BoatType; location: string; equipment: Equipment[]; badges: BadgeKind[]; sellerId: string;
  logbookCount: number; description: string; descriptionEn?: string | null; status: ListingStatus; photoSeed: number; cabins: number; engine: string;
  /** Motor saati ve bayrak (null = belirtilmedi); takasa açık, pazarlık payı var. Eski kayıtlarda alan olmayabilir. */
  engineHours?: number | null; flag?: Flag | null; tradeIn?: boolean; negotiable?: boolean;
  /** Gerçek modda: sunucudaki fotoğraflar, ham durum (draft/pending/rejected…), ilan sahibi mi, bağlı tekne ve karne özeti. */
  photoUrls?: string[]; photoIds?: string[]; rawStatus?: string; isMine?: boolean; boatId?: string | null; logbookLatest?: LogEntry[]; rejectReason?: string | null;
  /** Moderatör kaldırdıysa gerekçe (yalnızca ilan sahibine gelir). */
  removedReason?: TakedownReason | null;
  /** Yayın bitişi (yalnızca sahibine gelir). */
  expiresAt?: string | null;
  /** Öne çıkarma: vitrin/acil etkin mi; bitiş tarihleri yalnızca ilan sahibine gelir. */
  promo?: Promo;
  /** Son 30 günde indirim yapıldıysa önceki fiyat ve indirim anı. */
  priceDrop?: { previousPrice: number; at: string } | null;
  /** Sitedeki ilan adresi (paylaşım); satıcı istatistikleri yalnızca kendi ilanlarında gelir. */
  webUrl?: string; stats?: { views: number; favorites: number; messages: number };
}
export interface Promo { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string }
export type ListingDraft = Pick<Listing, 'brand' | 'model' | 'year' | 'lengthM' | 'price' | 'currency' | 'type' | 'location' | 'equipment' | 'cabins' | 'engine' | 'description'
  | 'engineHours' | 'flag' | 'tradeIn' | 'negotiable'>;

export type ProviderKind = 'usta' | 'kaptan' | 'eksper';

export interface ProviderDoc { name: string; expires: string; verified: boolean }
export interface Provider {
  id: string; kind: ProviderKind; name: string; categories: UstaCategory[]; rating: number; reviewCount: number;
  region: string; verified: boolean; docs: ProviderDoc[]; priceNote: string; bio: string;
  dayRateEUR?: number; weekRateEUR?: number; languages?: string[]; yearsExp: number; areas?: string[];
}

export type JobStatus = 'talep' | 'teklif' | 'onay' | 'devam' | 'tamam' | 'degerlendirildi' | 'iptal';
export const JOB_STEPS: JobStatus[] = ['talep', 'teklif', 'onay', 'devam', 'tamam'];
export interface Offer { id: string; providerId: string; priceTRY: number; days: number; note: string }
export interface Job {
  id: string; category: UstaCategory; title: string; description: string; boatId: string; status: JobStatus;
  offers: Offer[]; acceptedOfferId?: string; paid: boolean; rating?: number; createdAt: string;
  /** Gerçek mod: usta işi bitirdi dedi; `autoReleaseAt`'e kadar onaylanmaz ya da sorun bildirilmezse ödeme aktarılır. */
  deliveredAt?: string | null; autoReleaseAt?: string | null; disputed?: boolean;
}
export type JobInput = Pick<Job, 'category' | 'title' | 'description' | 'boatId'>;

export type LogKind = 'bakim' | 'onarim' | 'ekspertiz' | 'sahiplik';
export interface LogEntry { id: string; date: string; kind: LogKind; title: string; by: string; verified: boolean }
export interface Boat { id: string; name: string; brand: string; model: string; year: number; lengthM: number; photoSeed: number; logbook: LogEntry[] }
export type BoatInput = Pick<Boat, 'name' | 'brand' | 'model' | 'year' | 'lengthM'>;

export interface Message { id: string; from: 'me' | 'them' | 'system'; text: string; at: string }
export type SubjectKind = 'ilan' | 'is' | 'kaptan' | 'broker';
export interface Conversation {
  id: string; withName: string; subject: { kind: SubjectKind; id: string; title: string };
  phoneShared: boolean; unread: boolean; messages: Message[];
  /** Gerçek modda: karşı tarafın paylaştığı numara ve son mesaj önizlemesi. */
  otherPhone?: string | null; preview?: string;
  /** Engel: `me` ben engelledim (kaldırabilirim), `them` karşı taraf engelledi; ikisinde de yazılamaz. */
  blocked?: 'me' | 'them' | null;
}

export interface SavedSearch { id: string; query: string; createdAt: string; newMatches: number }
export interface CaptainBooking {
  id: string; captainId: string; start: string; days: number; totalEUR: number; paid: boolean;
  /** Gerçek modda sunucu durumu: requested | paid | done | cancelled; `reviewed` değerlendirildi mi. */
  status?: 'requested' | 'paid' | 'done' | 'cancelled'; reviewed?: boolean; autoReleaseAt?: string | null; disputed?: boolean;
}
export interface ExpertiseBooking { id: string; packageId: string; listingId?: string; date: string; slot: string; reportStatus?: string; score?: number | null }
export interface ExpertisePackage { id: string; name: string; priceTRY: number; items: string[] }
export interface BrokerCase { id: string; boatName: string; step: 0 | 1 | 2 | 3 | 4; askingEUR: number; createdAt: string }
export interface Company { id: string; name: string; kind: 'galeri' | 'broker' | 'tersane' | 'servis'; city: string; staff: string[]; listingIds: string[] }
export type AdminStatus = 'bekliyor' | 'onaylandi' | 'reddedildi';
export interface AdminItem {
  id: string; kind: 'ilan' | 'belge'; title: string; who: string; status: AdminStatus; refId?: string;
  /** Gerçek modda moderatörün görmesi gerekenler: ilan fotoğrafları, korumalı belge kimlikleri, pasaport bilgileri. */
  photos?: string[]; fileIds?: string[]; details?: Record<string, unknown> | null;
  /** İlan kararı bu sürüme bağlanır; satıcı o arada değiştirirse sunucu kararı reddeder. */
  version?: string;
  /** Yayına çıkacak ilan içeriği (moderatör onaylamadan önce tamamını görür). */
  listing?: AdminListingInfo;
}
export type RejectReason = 'blurry' | 'mismatch' | 'rules';
export type { ReportReason, TakedownReason };
/** Moderatörün bildirim kuyruğu: ilana göre gruplanmış açık bildirimler. */
export interface ReportGroup {
  listing: {
    id: string; title: string; year: number; price: number; currency: Currency; status: string; description: string;
    owner: { id: string; name: string | null; verifyLevel: number; suspended: boolean };
  };
  count: number;
  reports: { id: string; reason: ReportReason; note: string; createdAt: string; reporterName: string | null }[];
}
export interface AdminListingInfo {
  year: number; price: number; currency: Currency; lengthM: number; type: BoatType; location: string; cabins: number;
  engine: string; engineHours: number | null; flag: Flag | null; tradeIn: boolean; negotiable: boolean; equipment: Equipment[];
  /** Firma adına ilan (yalnızca yeni ilanda). */
  companyId?: string;
  description: string; ownerVerifyLevel: number;
  /** Yeniden gönderilen ilanda önceki red gerekçesi (ör. 'blurry'). */
  previousRejectReason?: string | null;
  /** Aynı fotoğrafın geçtiği diğer ilanlar (başka satıcı: çalıntı şüphesi; aynı satıcı: mükerrer). */
  photoDuplicates?: { listingId: string; title: string; status: string; sameOwner: boolean }[];
}
/** İşlem kaydı dile bağlı metin değil, çeviri anahtarı + parametre taşır. */
export interface AuditEntry { id: string; at: string; who: string; key: string; params?: Record<string, string> }
export interface Seller {
  id: string; name: string; since: number; companyId?: string; companyName?: string | null;
  /** Kimliğini doğrulattı mı; "Doğrulanmış" rozeti yalnızca bu durumda. */
  verified?: boolean;
}
export type Role = 'bireysel' | 'usta' | 'kaptan' | 'kurumsal' | 'yonetici';
