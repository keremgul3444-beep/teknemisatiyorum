import { z } from 'zod';

export const CURRENCIES = ['TRY', 'EUR', 'USD'] as const;
export const BOAT_TYPES = ['motoryat', 'yelkenli', 'gulet', 'surat', 'balikci', 'katamaran'] as const;
export const EQUIPMENT = ['jenerator', 'branda', 'klima', 'radar', 'otopilot', 'bowThruster', 'teak', 'tender'] as const;
/** Bayrak: Türk bayraklı ya da yabancı bayraklı (alıcı için vergi/kayıt durumunu belirler). */
export const FLAGS = ['tr', 'foreign'] as const;
/** İlan başına en fazla fotoğraf (sunucu ve uygulama aynı sınırı kullanır). */
export const MAX_LISTING_PHOTOS = 20;
/** Alıcının ilanı bildirme gerekçeleri. */
export const REPORT_REASONS = ['scam', 'wrong_info', 'sold', 'offensive', 'other'] as const;
/** Moderatörün yayındaki ilanı kaldırma gerekçeleri ("account_suspended" yalnızca askıya almada sunucu yazar). */
export const TAKEDOWN_REASONS = ['scam', 'wrong_info', 'offensive', 'rules'] as const;
/** Bir kullanıcının 24 saatte gönderebileceği en fazla bildirim. */
export const MAX_REPORTS_PER_DAY = 10;
/** İlan formunda motor saati üst sınırı (daha büyüğü yazım hatasıdır). */
export const MAX_ENGINE_HOURS = 100000;
export const USTA_CATEGORIES = ['motor', 'elektrik', 'boya', 'jelkot', 'branda', 'doseme', 'elektronik', 'yelken'] as const;

export type Currency = (typeof CURRENCIES)[number];
export type BoatType = (typeof BOAT_TYPES)[number];
export type Equipment = (typeof EQUIPMENT)[number];
export type Flag = (typeof FLAGS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type TakedownReason = (typeof TAKEDOWN_REASONS)[number] | 'account_suspended';
export type UstaCategory = (typeof USTA_CATEGORIES)[number];
export type BadgeKind = 'ekspertizli' | 'sahiplik' | 'broker' | 'belge';
export type ListingStatus = 'yayinda' | 'onay-bekliyor' | 'reddedildi' | 'satildi' | 'kaldirildi';

const pos = z.number().finite().positive().max(1e9);
const year = z.number().int().min(1900).max(2100);

/** Akıllı Asistan ve filtre ekranının ortak sözleşmesi. Bilinmeyen alanlar atılır. */
export const parsedQuerySchema = z.object({
  minLength: pos.max(200).optional(),
  maxLength: pos.max(200).optional(),
  minYear: year.optional(),
  maxYear: year.optional(),
  minPrice: pos.optional(),
  maxPrice: pos.optional(),
  currency: z.enum(CURRENCIES).optional(),
  equipment: z.array(z.enum(EQUIPMENT)).max(8).default([]),
  type: z.enum(BOAT_TYPES).optional(),
  location: z.string().max(40).optional(),
});
export type ParsedQuery = z.infer<typeof parsedQuerySchema>;

/** Eşleştirmenin ihtiyaç duyduğu asgari ilan biçimi (mobil sahte veri ve sunucu kaydı ikisi de uyar). */
export interface MatchableListing {
  lengthM: number; year: number; price: number; currency: Currency; type: BoatType;
  location: string; equipment: Equipment[]; status: string;
}
