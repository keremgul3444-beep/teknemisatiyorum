export type Currency = 'TRY' | 'EUR' | 'USD';
export type BoatType = 'motoryat' | 'yelkenli' | 'gulet' | 'surat' | 'balikci' | 'katamaran';
export type Equipment = 'jenerator' | 'branda' | 'klima' | 'radar' | 'otopilot' | 'bowThruster' | 'teak' | 'tender';
export type BadgeKind = 'ekspertizli' | 'sahiplik' | 'broker';
export type ListingStatus = 'yayinda' | 'onay-bekliyor' | 'satildi';

export interface Listing {
  id: string; brand: string; model: string; year: number; lengthM: number; price: number; currency: Currency;
  type: BoatType; location: string; equipment: Equipment[]; badges: BadgeKind[]; sellerId: string;
  logbookCount: number; description: string; status: ListingStatus; photoSeed: number; cabins: number; engine: string;
}
export type ListingDraft = Pick<Listing, 'brand' | 'model' | 'year' | 'lengthM' | 'price' | 'currency' | 'type' | 'location' | 'equipment' | 'cabins' | 'engine' | 'description'>;

export type ProviderKind = 'usta' | 'kaptan' | 'eksper';
export type UstaCategory = 'motor' | 'elektrik' | 'boya' | 'jelkot' | 'branda' | 'doseme' | 'elektronik' | 'yelken';
export const USTA_CATEGORIES: UstaCategory[] = ['motor', 'elektrik', 'boya', 'jelkot', 'branda', 'doseme', 'elektronik', 'yelken'];

export interface ProviderDoc { name: string; expires: string; verified: boolean }
export interface Provider {
  id: string; kind: ProviderKind; name: string; categories: UstaCategory[]; rating: number; reviewCount: number;
  region: string; verified: boolean; docs: ProviderDoc[]; priceNote: string; bio: string;
  dayRateEUR?: number; weekRateEUR?: number; languages?: string[]; yearsExp: number; areas?: string[];
}

export type JobStatus = 'talep' | 'teklif' | 'onay' | 'devam' | 'tamam' | 'degerlendirildi';
export const JOB_STEPS: JobStatus[] = ['talep', 'teklif', 'onay', 'devam', 'tamam'];
export interface Offer { id: string; providerId: string; priceTRY: number; days: number; note: string }
export interface Job {
  id: string; category: UstaCategory; title: string; description: string; boatId: string; status: JobStatus;
  offers: Offer[]; acceptedOfferId?: string; paid: boolean; rating?: number; createdAt: string;
}
export type JobInput = Pick<Job, 'category' | 'title' | 'description' | 'boatId'>;

export type LogKind = 'bakim' | 'onarim' | 'ekspertiz' | 'sahiplik';
export interface LogEntry { id: string; date: string; kind: LogKind; title: string; by: string; verified: boolean }
export interface Boat { id: string; name: string; brand: string; model: string; year: number; lengthM: number; photoSeed: number; logbook: LogEntry[] }
export type BoatInput = Pick<Boat, 'name' | 'brand' | 'model' | 'year' | 'lengthM'>;

export interface Message { id: string; from: 'me' | 'them' | 'system'; text: string; at: string }
export type SubjectKind = 'ilan' | 'is' | 'kaptan';
export interface Conversation {
  id: string; withName: string; subject: { kind: SubjectKind; id: string; title: string };
  phoneShared: boolean; unread: boolean; messages: Message[];
}

export interface SavedSearch { id: string; query: string; createdAt: string; newMatches: number }
export interface CaptainBooking { id: string; captainId: string; start: string; days: number; totalEUR: number; paid: boolean }
export interface ExpertiseBooking { id: string; packageId: string; listingId?: string; date: string; slot: string }
export interface ExpertisePackage { id: string; name: string; priceTRY: number; items: string[] }
export interface BrokerCase { id: string; boatName: string; step: 0 | 1 | 2 | 3 | 4; askingEUR: number; createdAt: string }
export interface Company { id: string; name: string; kind: 'galeri' | 'broker' | 'tersane' | 'servis'; city: string; staff: string[]; listingIds: string[] }
export type AdminStatus = 'bekliyor' | 'onaylandi' | 'reddedildi';
export interface AdminItem { id: string; kind: 'ilan' | 'belge'; title: string; who: string; status: AdminStatus; refId?: string }
export interface AuditEntry { id: string; at: string; who: string; action: string }
export interface Seller { id: string; name: string; since: number; companyId?: string }
export type Role = 'bireysel' | 'usta' | 'kaptan' | 'kurumsal' | 'yonetici';
