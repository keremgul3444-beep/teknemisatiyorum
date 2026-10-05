import { MAX_ENGINE_HOURS, MAX_LISTING_PHOTOS, type BoatType, type Currency, type Equipment, type Flag, type ListingFacts } from '@tms/shared';
import type { Listing, ListingDraft } from '@/services/types';

export { MAX_LISTING_PHOTOS };
export const WIZARD_STEPS = ['photos', 'basics', 'equipment', 'price', 'docs'] as const;

/**
 * Sihirbazdaki fotoğraf: gerçek modda cihazdaki dosya adresi, demo modunda yalnızca örnek görsel tohumu.
 * Düzenlemede ilandaki fotoğraflar sunucudaki dosya kimliğiyle (fileId) gelir; yeniden yüklenmez.
 */
export interface PhotoItem { id: string; uri?: string; seed: number; fileId?: string }

export interface WizardFields {
  brand: string; model: string; year: string; length: string; cabins: string; engine: string; engineHours: string;
  description: string; price: string;
}
export interface WizardState {
  step: number;
  photos: PhotoItem[];
  f: WizardFields;
  type?: BoatType; equipment: Equipment[]; currency: Currency; location?: string; flag?: Flag;
  tradeIn: boolean; negotiable: boolean; broker: boolean;
  doc: boolean; docUri: string | null; engineDoc: boolean; engineDocUri: string | null; engineSerial: string;
  /** Sunucuda açılmış yarım taslağın kimliği: uygulama kapanıp açılırsa ikinci ilan açılmaz. */
  serverId?: string;
  /** Firma adına ilan (yalnızca yeni ilanda seçilir; boş: bireysel). */
  companyId?: string;
}

export const emptyWizard = (): WizardState => ({
  step: 0, photos: [],
  f: { brand: '', model: '', year: '', length: '', cabins: '', engine: '', engineHours: '', description: '', price: '' },
  equipment: [], currency: 'EUR', tradeIn: false, negotiable: false, broker: false,
  doc: false, docUri: null, engineDoc: false, engineDocUri: null, engineSerial: '',
});

// ——— Fotoğraf listesi: ilk fotoğraf kapaktır ———

export function addPhotos(list: PhotoItem[], items: Omit<PhotoItem, 'id'>[], newId: () => string): PhotoItem[] {
  const room = Math.max(0, MAX_LISTING_PHOTOS - list.length);
  return [...list, ...items.slice(0, room).map((p) => ({ ...p, id: newId() }))];
}
export const removePhoto = (list: PhotoItem[], id: string) => list.filter((p) => p.id !== id);
/** Fotoğrafı bir sola (-1) ya da sağa (+1) kaydırır; uçlarda değişiklik yok. */
export function movePhoto(list: PhotoItem[], id: string, dir: -1 | 1): PhotoItem[] {
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
export function makeCover(list: PhotoItem[], id: string): PhotoItem[] {
  const p = list.find((x) => x.id === id);
  return p ? [p, ...list.filter((x) => x.id !== id)] : list;
}

// ——— Sayılar ———

/** Kullanıcının yazdığı sayıyı okur: "12,4" → 12.4, boş → NaN. Fiyattaki binlik noktaları atlar. */
export const parseNum = (s: string) => (s.trim() ? Number(s.replace(/\./g, '').replace(',', '.')) : NaN);
const parseDecimal = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : NaN);
export const digitsOnly = (s: string) => s.replace(/\D/g, '');
/** Fiyat kutusunda binlik ayraç: "149000" → "149.000" (tr) / "149,000" (en). */
export function groupThousands(digits: string, lang: string): string {
  const d = digitsOnly(digits).replace(/^0+(?=\d)/, '');
  return d ? Number(d).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 0 }) : '';
}

// ——— Doğrulama: alan → çeviri anahtarı ———

export type StepErrors = Partial<Record<'photos' | 'brand' | 'model' | 'year' | 'length' | 'type' | 'engineHours' | 'price' | 'location', string>>;

export function validateStep(step: number, s: WizardState, now = new Date()): StepErrors {
  const e: StepErrors = {};
  if (step === 0 && s.photos.length === 0) e.photos = 'wizard.err.photos';
  if (step === 1) {
    if (!s.f.brand.trim()) e.brand = 'wizard.err.required';
    if (!s.f.model.trim()) e.model = 'wizard.err.required';
    const year = Number(s.f.year);
    if (!s.f.year) e.year = 'wizard.err.required';
    else if (!(year >= 1900 && year <= now.getFullYear() + 1)) e.year = 'wizard.err.year';
    const len = parseDecimal(s.f.length);
    if (!s.f.length.trim()) e.length = 'wizard.err.required';
    else if (!(len > 2 && len <= 200)) e.length = 'wizard.err.length';
    if (!s.type) e.type = 'wizard.err.type';
    if (s.f.engineHours && !(Number(s.f.engineHours) <= MAX_ENGINE_HOURS)) e.engineHours = 'wizard.err.engineHours';
  }
  if (step === 3) {
    if (!(parseNum(s.f.price) > 0)) e.price = 'wizard.err.price';
    if (!s.location) e.location = 'wizard.err.location';
  }
  return e;
}

/** Önizlemeye geçmeden tüm adımlar denetlenir (geri yüklenen ya da geri dönülüp değiştirilen taslak için); ilk hatalı adım ya da -1. */
export function firstInvalidStep(s: WizardState, now = new Date()): number {
  return WIZARD_STEPS.findIndex((_, i) => Object.keys(validateStep(i, s, now)).length > 0);
}

/** Düzenleme: yayındaki/bekleyen/reddedilen ilan sihirbaz durumuna çevrilir (fotoğraflar sunucudaki sırasıyla). */
export function fromListing(l: Listing, lang = 'tr'): WizardState {
  const dec = (n: number) => (lang === 'tr' ? String(n).replace('.', ',') : String(n));
  return {
    ...emptyWizard(),
    // Demo ilanlarının gerçek fotoğrafı yoktur (örnek görsel tohumu): kapak tek fotoğraf olarak gelir ve değişmemiş sayılır.
    photos: l.photoUrls?.length
      ? l.photoUrls.map((uri, i) => ({ id: `e${i}`, uri, seed: l.photoSeed + i, fileId: l.photoIds?.[i] }))
      : [{ id: 'e0', seed: l.photoSeed, fileId: `demo:${l.photoSeed}` }],
    f: {
      brand: l.brand, model: l.model, year: String(l.year), length: dec(l.lengthM), cabins: l.cabins ? String(l.cabins) : '',
      engine: l.engine === '—' ? '' : l.engine, engineHours: l.engineHours != null ? String(l.engineHours) : '',
      description: l.description === '—' ? '' : l.description, price: String(Math.round(l.price)),
    },
    type: l.type, equipment: [...l.equipment], currency: l.currency, location: l.location, flag: l.flag ?? undefined,
    tradeIn: !!l.tradeIn, negotiable: !!l.negotiable,
  };
}

/** Yalnızca değişen alanlar: sunucu yalnızca fiyat değişikliğini yeniden onaya göndermez, bu yüzden fark gönderilir. */
export function draftChanges(before: ListingDraft, after: ListingDraft): Partial<ListingDraft> {
  const out: Partial<ListingDraft> = {};
  for (const k of Object.keys(after) as (keyof ListingDraft)[]) {
    const a = before[k];
    const b = after[k];
    const same = Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : (a ?? null) === (b ?? null);
    if (!same) (out as Record<string, unknown>)[k] = b;
  }
  return out;
}
export const photosChanged = (before: PhotoItem[], after: PhotoItem[]) =>
  before.length !== after.length || after.some((p, i) => !p.fileId || p.fileId !== before[i].fileId);

export function toDraft(s: WizardState): ListingDraft {
  return {
    brand: s.f.brand.trim(), model: s.f.model.trim(), year: Number(s.f.year), lengthM: parseDecimal(s.f.length),
    price: parseNum(s.f.price), currency: s.currency, type: s.type ?? 'motoryat', location: s.location ?? '', equipment: s.equipment,
    cabins: Number(s.f.cabins) || 0, engine: s.f.engine.trim(), description: s.f.description.trim(),
    engineHours: s.f.engineHours ? Number(s.f.engineHours) : null, flag: s.flag ?? null, tradeIn: s.tradeIn, negotiable: s.negotiable,
    ...(s.companyId ? { companyId: s.companyId } : {}),
  };
}

// ——— Taslak kaydı ———

/** Uygulama yeniden açıldığında dosyası hâlâ okunabilen adresler; tarayıcıdaki geçici (blob/data) adresler saklanmaz. */
const persistableUri = (u?: string | null) => !!u && !/^(blob|data):/i.test(u);

/** Kullanıcı henüz hiçbir şey girmediyse taslak saklanmaz. */
export function isBlank(s: WizardState): boolean {
  return s.photos.length === 0 && Object.values(s.f).every((v) => !v.trim()) && !s.type && !s.location && s.equipment.length === 0 && !s.doc && !s.engineDoc;
}

export function serializeDraft(s: WizardState): string {
  const keep = (u: string | null) => (persistableUri(u) ? u : null);
  return JSON.stringify({
    v: 1,
    ...s,
    // Demo fotoğrafları (adressiz) ve cihazdaki dosyalar saklanır; geçici tarayıcı adresleri düşer.
    photos: s.photos.filter((p) => !p.uri || persistableUri(p.uri)),
    docUri: keep(s.docUri), doc: s.doc && (!s.docUri || persistableUri(s.docUri)),
    engineDocUri: keep(s.engineDocUri), engineDoc: s.engineDoc && (!s.engineDocUri || persistableUri(s.engineDocUri)),
  });
}

/**
 * Geri yüklenen taslakta cihazdan silinmiş dosyalar düşer (fotoğraf, ruhsat, motor belgesi).
 * Kaç fotoğrafın kaybolduğu da döner; kullanıcıya söylenir.
 */
export function dropMissingFiles(s: WizardState, exists: (uri: string) => boolean): { state: WizardState; lostPhotos: number } {
  const photos = s.photos.filter((p) => !p.uri || exists(p.uri));
  const docOk = !s.docUri || exists(s.docUri);
  const engineOk = !s.engineDocUri || exists(s.engineDocUri);
  const state: WizardState = {
    ...s, photos,
    ...(docOk ? {} : { doc: false, docUri: null }),
    ...(engineOk ? {} : { engineDoc: false, engineDocUri: null }),
  };
  if (photos.length === 0) state.step = 0;
  return { state, lostPhotos: s.photos.length - photos.length };
}

/** Saklanan taslağı okur; bozuk ya da eski biçimdeyse null. */
export function restoreDraft(raw: string | null): WizardState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (o?.v !== 1 || !Array.isArray(o.photos) || typeof o.f !== 'object') return null;
    const base = emptyWizard();
    const s: WizardState = { ...base, ...o, f: { ...base.f, ...o.f } };
    delete (s as Partial<WizardState> & { v?: number }).v;
    s.photos = s.photos.slice(0, MAX_LISTING_PHOTOS);
    s.step = Math.min(Math.max(0, Number(s.step) || 0), WIZARD_STEPS.length - 1);
    // Fotoğraflar geri gelmediyse (ör. tarayıcıda) kullanıcı önce fotoğraf adımına döner.
    if (s.photos.length === 0) s.step = 0;
    return isBlank(s) ? null : s;
  } catch {
    return null;
  }
}

/** Açıklama taslağı isteği: yazılı açıklama satıcının notu olarak gider. Zorunlu bilgiler eksikse null. */
export function describeFacts(s: WizardState): ListingFacts | null {
  const year = Number(s.f.year);
  const lengthM = parseNum(s.f.length);
  if (!s.f.brand.trim() || !s.f.model.trim() || !(year >= 1900) || !(lengthM > 0) || !s.type) return null;
  return {
    brand: s.f.brand.trim(), model: s.f.model.trim(), year, lengthM, type: s.type, equipment: s.equipment,
    ...(s.location ? { location: s.location } : {}), ...(Number(s.f.cabins) ? { cabins: Number(s.f.cabins) } : {}),
    ...(s.f.engine.trim() ? { engine: s.f.engine.trim() } : {}), ...(s.f.engineHours ? { engineHours: Number(s.f.engineHours) } : {}),
    ...(s.flag ? { flag: s.flag } : {}), ...(s.tradeIn ? { tradeIn: true } : {}), ...(s.negotiable ? { negotiable: true } : {}),
    ...(s.f.description.trim() ? { notes: s.f.description.trim().slice(0, 600) } : {}),
  };
}
