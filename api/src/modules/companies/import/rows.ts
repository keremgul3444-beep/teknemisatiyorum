import { BOAT_TYPES, EQUIPMENT, MAX_LISTING_PHOTOS, type BoatType, type Equipment } from '@tms/shared';

/** Toplu yüklemede en fazla satır (tek seferde). */
export const MAX_IMPORT_ROWS = 100;

/** Sütun adları (Türkçe/İngilizce, büyük-küçük harf ve Türkçe karakter farkı gözetilmez) → alan. */
const COLUMNS: Record<string, string[]> = {
  brand: ['marka', 'brand', 'make'],
  model: ['model'],
  year: ['yil', 'year', 'uretim yili'],
  lengthM: ['boy', 'boy m', 'boy metre', 'uzunluk', 'length', 'length m', 'loa'],
  type: ['tip', 'tur', 'tekne tipi', 'type'],
  price: ['fiyat', 'price'],
  currency: ['para', 'para birimi', 'doviz', 'currency'],
  location: ['konum', 'sehir', 'liman', 'location', 'city'],
  cabins: ['kabin', 'kabin sayisi', 'cabins'],
  engine: ['motor', 'engine'],
  engineHours: ['motor saati', 'engine hours', 'hours'],
  flag: ['bayrak', 'flag'],
  tradeIn: ['takas', 'trade in', 'tradein'],
  negotiable: ['pazarlik', 'negotiable'],
  equipment: ['donanim', 'equipment'],
  description: ['aciklama', 'description'],
  photos: ['fotograflar', 'fotograf', 'foto', 'photos', 'photo urls', 'resimler'],
};

/** Karşılaştırma anahtarı: küçük harf, Türkçe karakterler sadeleşir, ayraçlar boşluk olur. */
export const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR')
  .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c).replace(/i̇/g, 'i')
  .replace(/[_\-./()]+/g, ' ').replace(/\s+/g, ' ').trim();

const TYPE_WORDS: Record<string, BoatType> = {
  motoryat: 'motoryat', 'motor yat': 'motoryat', 'motor yacht': 'motoryat', yat: 'motoryat',
  yelkenli: 'yelkenli', 'yelkenli tekne': 'yelkenli', sailboat: 'yelkenli', 'sailing yacht': 'yelkenli', 'sail boat': 'yelkenli',
  gulet: 'gulet', 'gulet tekne': 'gulet',
  surat: 'surat', 'surat teknesi': 'surat', speedboat: 'surat', 'speed boat': 'surat', 'rib': 'surat',
  balikci: 'balikci', 'balikci teknesi': 'balikci', 'fishing boat': 'balikci', 'fishing': 'balikci',
  katamaran: 'katamaran', catamaran: 'katamaran',
};
const EQUIPMENT_WORDS: Record<string, Equipment> = {
  jenerator: 'jenerator', generator: 'jenerator', branda: 'branda', 'canvas cover': 'branda', bimini: 'branda',
  klima: 'klima', 'air conditioning': 'klima', ac: 'klima', radar: 'radar', otopilot: 'otopilot', autopilot: 'otopilot',
  'bas pervane': 'bowThruster', 'bas pervanesi': 'bowThruster', 'bow thruster': 'bowThruster', bowthruster: 'bowThruster',
  'tik guverte': 'teak', tik: 'teak', teak: 'teak', 'teak deck': 'teak', tender: 'tender', 'tender bot': 'tender', bot: 'tender',
};
const CURRENCY_WORDS: Record<string, string> = { eur: 'EUR', euro: 'EUR', '€': 'EUR', usd: 'USD', dolar: 'USD', $: 'USD', try: 'TRY', tl: 'TRY', '₺': 'TRY', gbp: 'GBP', sterlin: 'GBP', '£': 'GBP' };
const YES = new Set(['evet', 'var', 'e', 'x', '1', 'true', 'yes', 'y']);
const NO = new Set(['hayir', 'yok', 'h', '0', 'false', 'no', 'n', '']);

export type RowError = { row: number; field: string; code: string };
export type ImportRow = { row: number; draft: Record<string, unknown>; photos: string[] };

/** Başlık satırı → sütun eşlemesi; zorunlu sütun eksikse hata listesi. */
export function mapHeader(header: string[]) {
  const index: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = norm(h);
    const field = Object.entries(COLUMNS).find(([, names]) => names.includes(key))?.[0];
    if (field && index[field] === undefined) index[field] = i;
  });
  const missing = ['brand', 'model', 'year', 'lengthM', 'type', 'price', 'location', 'photos'].filter((f) => index[f] === undefined);
  return { index, missing };
}

/** "12,4" → 12.4; "145.000" / "145 000" / "145,000" (binlik) → 145000. */
export function number(s: string): number | null {
  const t = s.trim().replace(/[€$₺£\s]/g, '').replace(/(eur|usd|tl|try|gbp)$/i, '');
  if (!t) return null;
  let v = t;
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) v = v.replace(/[.,]/g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(v)) v = v.replace(/,/g, '');
  else v = v.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : null;
}

const bool = (s: string): boolean | null => (YES.has(norm(s)) ? true : NO.has(norm(s)) ? false : null);

/**
 * Bir veri satırı → ilan taslağı alanları ve fotoğraf bağlantıları. Doğrulamanın son sözü sunucu şemasındadır
 * (`draftSchema`); burada biçim çevirisi ve anlaşılır satır hataları üretilir.
 */
export function toImportRow(cells: string[], index: Record<string, number>, row: number): { ok: ImportRow } | { errors: RowError[] } {
  const get = (f: string) => (index[f] === undefined ? '' : (cells[index[f]] ?? '').trim());
  const errors: RowError[] = [];
  const err = (field: string, code: string) => errors.push({ row, field, code });
  const d: Record<string, unknown> = {};
  for (const f of ['brand', 'model', 'location'] as const) { if (get(f)) d[f] = get(f); else err(f, 'required'); }
  const year = number(get('year'));
  if (year === null || !Number.isInteger(year)) err('year', get('year') ? 'invalid' : 'required'); else d.year = year;
  const len = number(get('lengthM'));
  if (len === null) err('lengthM', get('lengthM') ? 'invalid' : 'required'); else d.lengthM = len;
  const price = number(get('price'));
  if (price === null || price <= 0) err('price', get('price') ? 'invalid' : 'required'); else d.price = price;
  const type = TYPE_WORDS[norm(get('type'))] ?? (BOAT_TYPES as readonly string[]).find((x) => x === get('type'));
  if (!type) err('type', get('type') ? 'invalid' : 'required'); else d.type = type;
  const cur = get('currency') ? CURRENCY_WORDS[norm(get('currency'))] ?? get('currency').toUpperCase() : 'EUR';
  d.currency = cur;
  if (get('cabins')) { const c = number(get('cabins')); if (c === null || !Number.isInteger(c)) err('cabins', 'invalid'); else d.cabins = c; }
  if (get('engine')) d.engine = get('engine');
  if (get('engineHours')) { const h = number(get('engineHours')); if (h === null || !Number.isInteger(h)) err('engineHours', 'invalid'); else d.engineHours = h; }
  if (get('flag')) {
    const f = norm(get('flag'));
    if (['tr', 'turk', 'turkiye', 'turk bayrakli', 'turkish'].includes(f)) d.flag = 'tr';
    else if (['yabanci', 'foreign', 'yabanci bayrakli'].includes(f)) d.flag = 'foreign';
    else err('flag', 'invalid');
  }
  for (const f of ['tradeIn', 'negotiable'] as const) {
    if (!get(f)) continue;
    const b = bool(get(f));
    if (b === null) err(f, 'invalid'); else d[f] = b;
  }
  if (get('equipment')) {
    const words = get('equipment').split(/[,;|/]+/).map((w) => w.trim()).filter(Boolean);
    const eq = words.map((w) => EQUIPMENT_WORDS[norm(w)] ?? (EQUIPMENT as readonly string[]).find((x) => x === w));
    if (eq.some((x) => !x)) err('equipment', 'invalid');
    else d.equipment = [...new Set(eq as Equipment[])];
  }
  if (get('description')) d.description = get('description');
  const photos = get('photos').split(/[\s|]+/).map((s) => s.trim()).filter(Boolean);
  if (!photos.length) err('photos', 'required');
  else if (photos.length > MAX_LISTING_PHOTOS) err('photos', 'tooMany');
  else if (photos.some((p) => !/^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(p))) err('photos', 'invalid');
  return errors.length ? { errors } : { ok: { row, draft: d, photos } };
}

/** Şablon (site "örnek dosyayı indir"): Türkçe Excel'in açtığı `;` ayraçlı, BOM'lu UTF-8. */
export const TEMPLATE_CSV = '﻿' + [
  'marka;model;yil;boy_m;tip;fiyat;para;konum;kabin;motor;motor_saati;bayrak;takas;pazarlik;donanim;aciklama;fotograflar',
  'Bavaria;Cruiser 41;2016;12,4;Yelkenli;145.000;EUR;Bodrum;3;Volvo Penta D2-40;850;Türk;Hayır;Evet;Jeneratör, Otopilot;Tek sahibinden, bakımlı.;https://ornek.com/foto1.jpg | https://ornek.com/foto2.jpg',
].join('\r\n') + '\r\n';
