import { MAX_ENGINE_HOURS, MAX_LISTING_PHOTOS, parseVideoUrl, type BoatType, type Currency, type Equipment, type Flag } from '@tms/shared';

/** Sitedeki ilan formu: uygulamadaki sihirbazla aynı kurallar (mobile/src/features/listingForm.ts). */
export const SELL_STEPS = ['photos', 'basics', 'equipment', 'price', 'review'] as const;
export { MAX_LISTING_PHOTOS };

export interface SellFields {
  brand: string; model: string; year: string; length: string; cabins: string; engine: string; engineHours: string; description: string; price: string;
  type: BoatType | ''; currency: Currency; location: string; flag: Flag | ''; equipment: Equipment[]; tradeIn: boolean; negotiable: boolean;
  /** Firma adına verilen ilan (boş: bireysel). */
  companyId: string;
  /** YouTube / Vimeo / Instagram bağlantısı (isteğe bağlı). */
  videoUrl: string;
}

export const emptySell = (): SellFields => ({
  brand: '', model: '', year: '', length: '', cabins: '', engine: '', engineHours: '', description: '', price: '',
  type: '', currency: 'EUR', location: '', flag: '', equipment: [], tradeIn: false, negotiable: false, companyId: '', videoUrl: '',
});

/** "12,4" → 12.4; fiyattaki binlik noktalar atlanır. Boş → NaN. */
export const decimal = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : NaN);
export const digits = (s: string) => s.replace(/\D/g, '');

export type SellErrors = Partial<Record<'photos' | 'brand' | 'model' | 'year' | 'length' | 'type' | 'engineHours' | 'price' | 'location' | 'videoUrl', string>>;

/** Adım doğrulaması: alan → hata anahtarı (sell.err.*). */
export function validateSell(step: number, f: SellFields, photoCount: number, now = new Date()): SellErrors {
  const e: SellErrors = {};
  if (step === 0 && photoCount === 0) e.photos = 'photos';
  if (step === 1) {
    if (!f.brand.trim()) e.brand = 'required';
    if (!f.model.trim()) e.model = 'required';
    const y = Number(f.year);
    if (!f.year) e.year = 'required';
    else if (!(y >= 1900 && y <= now.getFullYear() + 1)) e.year = 'year';
    const len = decimal(f.length);
    if (!f.length.trim()) e.length = 'required';
    else if (!(len > 2 && len <= 200)) e.length = 'length';
    if (!f.type) e.type = 'type';
    if (f.engineHours && !(Number(f.engineHours) <= MAX_ENGINE_HOURS)) e.engineHours = 'engineHours';
    if (f.videoUrl.trim() && !parseVideoUrl(f.videoUrl)) e.videoUrl = 'video';
  }
  if (step === 3) {
    if (!(Number(digits(f.price)) > 0)) e.price = 'price';
    if (!f.location) e.location = 'location';
  }
  return e;
}

/** Gönderimden önce tüm adımlar; ilk hatalı adım ya da -1. */
export const firstInvalid = (f: SellFields, photoCount: number, now = new Date()) =>
  SELL_STEPS.findIndex((_, i) => Object.keys(validateSell(i, f, photoCount, now)).length > 0);

/** Sunucunun taslak biçimi (POST /listings). */
export function toDraft(f: SellFields) {
  return {
    brand: f.brand.trim(), model: f.model.trim(), year: Number(f.year), lengthM: decimal(f.length), price: Number(digits(f.price)),
    currency: f.currency, type: f.type || 'motoryat', location: f.location, equipment: f.equipment,
    cabins: Number(f.cabins) || 0, engine: f.engine.trim(), description: f.description.trim(),
    engineHours: f.engineHours ? Number(f.engineHours) : null, flag: f.flag || null, tradeIn: f.tradeIn, negotiable: f.negotiable,
    videoUrl: f.videoUrl.trim() || null,
    ...(f.companyId ? { companyId: f.companyId } : {}),
  };
}

/** Fotoğraf listesi işlemleri: ilk fotoğraf kapaktır. */
export function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
export const toCover = <T>(list: T[], i: number): T[] => (i <= 0 || i >= list.length ? list : [list[i], ...list.filter((_, k) => k !== i)]);

/** Taslağın tarayıcıda saklanan kısmı (fotoğraflar hariç: dosyalar sekme kapanınca okunamaz). */
export function restoreSell(raw: string | null): SellFields | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (typeof o !== 'object' || !o) return null;
    const base = emptySell();
    const merged = { ...base, ...o, equipment: Array.isArray(o.equipment) ? o.equipment : [] } as SellFields;
    return Object.keys(base).every((k) => typeof merged[k as keyof SellFields] === typeof base[k as keyof SellFields]) ? merged : null;
  } catch {
    return null;
  }
}

/** Düzenleme: sunucudaki ilan → form alanları (firma seçimi düzenlemede değişmez). */
export function fromListing(l: {
  brand: string; model: string; year: number; lengthM: number; cabins?: number; engine?: string; engineHours?: number | null; description: string;
  price: number; type: string; currency: Currency; location: string; flag?: Flag | null; equipment: string[]; tradeIn?: boolean; negotiable?: boolean;
  videoUrl?: string | null;
}, locale: 'tr' | 'en' = 'tr'): SellFields {
  return {
    ...emptySell(),
    brand: l.brand, model: l.model, year: String(l.year), length: locale === 'tr' ? String(l.lengthM).replace('.', ',') : String(l.lengthM),
    cabins: l.cabins ? String(l.cabins) : '', engine: l.engine ?? '', engineHours: l.engineHours != null ? String(l.engineHours) : '',
    description: l.description, price: String(l.price), type: l.type as BoatType, currency: l.currency, location: l.location,
    flag: l.flag ?? '', equipment: l.equipment as Equipment[], tradeIn: !!l.tradeIn, negotiable: !!l.negotiable, videoUrl: l.videoUrl ?? '',
  };
}

/** Düzenlemede yalnızca değişen alanlar gönderilir: yalnızca fiyat değişirse ilan yeniden onaya düşmez. */
export function changedDraft(before: SellFields, after: SellFields): Record<string, unknown> {
  const a = toDraft({ ...before, companyId: '' }) as Record<string, unknown>;
  const b = toDraft({ ...after, companyId: '' }) as Record<string, unknown>;
  return Object.fromEntries(Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => [k, b[k]]));
}

/** Açıklama taslağı isteği: yazılı açıklama satıcının notu olarak gider. Zorunlu bilgiler eksikse null. */
export function describeFacts(f: SellFields) {
  const year = Number(f.year);
  const lengthM = decimal(f.length);
  if (!f.brand.trim() || !f.model.trim() || !(year >= 1900) || !(lengthM > 0) || !f.type) return null;
  return {
    brand: f.brand.trim(), model: f.model.trim(), year, lengthM, type: f.type, equipment: f.equipment,
    ...(f.location ? { location: f.location } : {}), ...(Number(f.cabins) ? { cabins: Number(f.cabins) } : {}),
    ...(f.engine.trim() ? { engine: f.engine.trim() } : {}), ...(f.engineHours ? { engineHours: Number(f.engineHours) } : {}),
    ...(f.flag ? { flag: f.flag } : {}), ...(f.tradeIn ? { tradeIn: true } : {}), ...(f.negotiable ? { negotiable: true } : {}),
    ...(f.description.trim() ? { notes: f.description.trim().slice(0, 600) } : {}),
  };
}
