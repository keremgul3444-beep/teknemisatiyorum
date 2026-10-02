import type { BoatType, Currency, Equipment, ParsedQuery } from '../filter';

export type { ParsedQuery };


export const LOCATIONS = ['Bodrum', 'Göcek', 'Marmaris', 'Fethiye', 'İstanbul', 'Çeşme', 'Didim', 'Antalya', 'Kaş'];

const EQUIPMENT: [RegExp, Equipment][] = [
  [/jenerat[öo]r|generator/, 'jenerator'],
  [/branda|canvas|bimini/, 'branda'],
  [/klima|air ?con/, 'klima'],
  [/radar/, 'radar'],
  [/otopilot|autopilot/, 'otopilot'],
  [/ba[şs] pervane|bow ?thruster/, 'bowThruster'],
  [/(^|\s)tik(\s|$)|teak/, 'teak'],
  [/tender|(^|\s)botu?(\s|$)/, 'tender'],
];

const TYPES: [RegExp, BoatType][] = [
  [/yelkenli|sail/, 'yelkenli'],
  [/katamaran|catamaran/, 'katamaran'],
  [/gulet/, 'gulet'],
  [/s[üu]rat|speed ?boat/, 'surat'],
  [/bal[ıi]k[çc][ıi]|fishing/, 'balikci'],
  [/motor ?yat|motor yacht/, 'motoryat'],
];

const CURRENCY: Record<string, Currency> = {
  tl: 'TRY', '₺': 'TRY', lira: 'TRY', euro: 'EUR', eur: 'EUR', '€': 'EUR', dolar: 'USD', usd: 'USD', $: 'USD',
};
const MULT: Record<string, number> = { bin: 1e3, k: 1e3, milyon: 1e6, million: 1e6, mn: 1e6 };

const toNumber = (s: string) => (/^\d{1,3}([.,]\d{3})+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : parseFloat(s.replace(',', '.')));

// Bir sayının hemen arkasındaki (başka sayıya geçmeden) bağlam kelimesini arar.
const after = (text: string, from: number, words: string, span: number) =>
  new RegExp(`^[^\\d]{0,${span}}?(${words})`).exec(text.slice(from));
const before = (text: string, to: number, words: string, span: number) =>
  new RegExp(`(${words})[^\\d]{0,${span}}$`).test(text.slice(0, to));
const blank = (text: string, start: number, end: number) => text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);

export function parseQuery(input: string): ParsedQuery {
  let text = ` ${input.toLocaleLowerCase('tr-TR').replace(/’/g, "'")} `;
  const q: ParsedQuery = { equipment: [] };

  // 1) Fiyat — önce ki "2000 euro" yıl sanılmasın.
  const priceA = /([€$₺])\s*(\d+(?:[.,]\d+)*)\s*(bin|k|milyon|million|mn)?/.exec(text);
  const priceB = /(\d+(?:[.,]\d+)*)\s*(bin|k|milyon|million|mn)?\s*(tl|₺|lira|euro|eur|€|dolar|usd|\$)/.exec(text);
  // Para birimi yazılmamış ama çarpan kelimesi olan tutar ("300 bine kadar", "2 milyona kadar") TL sayılır.
  const priceC = priceA || priceB ? null : /(\d+(?:[.,]\d+)*)\s*(bin|milyon|million|mn)[a-zçğıöşü]*/.exec(text);
  const pm = priceA ?? priceB ?? priceC;
  if (pm) {
    const [numStr, multStr, curStr] = priceA ? [pm[2], pm[3], pm[1]] : priceB ? [pm[1], pm[2], pm[3]] : [pm[1], pm[2], 'tl'];
    const value = toNumber(numStr) * (multStr ? MULT[multStr] : 1);
    const end = pm.index + pm[0].length;
    q.currency = CURRENCY[curStr];
    let ctxEnd = end;
    const around = after(text, end, "civar\\S*|tutar\\S*|around|about", 14);
    const min = after(text, end, 'üstü|üzeri|over|above', 14);
    const max = after(text, end, "kadar|altı\\S*|max", 14);
    if (around) {
      q.minPrice = Math.round(value * 0.85);
      q.maxPrice = Math.round(value * 1.15);
      ctxEnd = end + around[0].length;
    } else if (min) {
      q.minPrice = value;
      ctxEnd = end + min[0].length;
    } else {
      q.maxPrice = value;
      if (max) ctxEnd = end + max[0].length;
    }
    text = blank(text, pm.index, ctxEnd);
  }

  // 1b) Motor saati — yıldan önce ("2000 saat" model yılı sanılmasın). "1000 saat altı", "motor saati 1500'e kadar", "max 800 hours".
  const hm = /motor saati\s*(?:en fazla|max\.?)?\s*(\d+(?:[.,]\d{3})*)|(\d+(?:[.,]\d{3})*)\s*(?:motor\s*)?(?:saat\S*|hours?|hrs?)(?![a-zçğıöşü])/.exec(text);
  if (hm) {
    q.maxEngineHours = Math.round(toNumber(hm[1] ?? hm[2]));
    const end = hm.index + hm[0].length;
    const ctx = after(text, end, "kadar|altı\\S*|az|max|under|or less", 14);
    text = blank(text, hm.index, ctx ? end + ctx[0].length : end);
  }

  // 2) Yıl — önce "2010-2015" gibi aralık
  const yr = /(19[5-9]\d|20[0-4]\d)\s*[-–]\s*(19[5-9]\d|20[0-4]\d)(?!\d)/.exec(text);
  if (yr) {
    q.minYear = Number(yr[1]);
    q.maxYear = Number(yr[2]);
    text = blank(text, yr.index, yr.index + yr[0].length);
  }
  const ym = yr ? null : /(^|[^\d])(19[5-9]\d|20[0-4]\d)(?!\d)/.exec(text);
  if (ym) {
    const year = Number(ym[2]);
    const start = ym.index + ym[1].length;
    const end = start + 4;
    const newer = after(text, end, 'sonra\\S*|üzeri|ve üstü|yeni|after|newer', 16);
    const older = after(text, end, 'önce\\S*|before|older', 16);
    let ctxEnd = end;
    if (newer || before(text, start, 'after|since', 6)) {
      q.minYear = year;
      if (newer) ctxEnd = end + newer[0].length;
    } else if (older || before(text, start, 'before', 6)) {
      q.maxYear = year;
      if (older) ctxEnd = end + older[0].length;
    } else {
      q.minYear = year;
      q.maxYear = year;
    }
    text = blank(text, start, ctxEnd);
  }

  // 3) Boy — önce "10-14 metre" gibi aralık
  const lr = /(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(m(?![a-zçğıöşü])|mt(?![a-z])|metre\S*|meter\S*)/.exec(text);
  if (lr) {
    q.minLength = toNumber(lr[1]);
    q.maxLength = toNumber(lr[2]);
    text = blank(text, lr.index, lr.index + lr[0].length);
  }
  const lm = lr ? null : /(\d+(?:[.,]\d+)?)\s*(m(?![a-zçğıöşü])|mt(?![a-z])|metre\S*|meter\S*)/.exec(text);
  if (lm) {
    const n = toNumber(lm[1]);
    const end = lm.index + lm[0].length;
    const max = after(text, end, 'kadar|altı\\S*|max', 12);
    const min = after(text, end, 'üstü|üzeri|fazla|over|above', 12);
    let ctxEnd = end;
    if (max || before(text, lm.index, 'up to|under|max', 4)) {
      q.maxLength = n;
      if (max) ctxEnd = end + max[0].length;
    } else if (min || before(text, lm.index, 'over|above|min', 4)) {
      q.minLength = n;
      if (min) ctxEnd = end + min[0].length;
    } else {
      q.minLength = n - 1;
      q.maxLength = n + 1;
    }
    text = blank(text, lm.index, ctxEnd);
  }

  // 4) Ekipman — metindeki sırayla, tekrarsız
  q.equipment = EQUIPMENT
    .map(([re, eq]) => ({ eq, at: text.search(re) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.eq);

  // 5) Tip
  const tm = TYPES.find(([re]) => re.test(text));
  if (tm) q.type = tm[1];

  // 6) Konum
  const loc = LOCATIONS.find((l) => text.includes(l.toLocaleLowerCase('tr-TR')));
  if (loc) q.location = loc;

  // 7) Bayrak, takas, pazarlık
  if (/yabanc[ıi] bayrak|foreign flag/.test(text)) q.flag = 'foreign';
  else if (/t[üu]rk bayrak|tr bayrak|turkish flag/.test(text)) q.flag = 'tr';
  if (/takas|trade[- ]?in/.test(text)) q.tradeIn = true;
  if (/pazarl[ıi]k|negotiable/.test(text)) q.negotiable = true;

  return q;
}

export function isEmptyQuery(q: ParsedQuery): boolean {
  return q.equipment.length === 0 && Object.entries(q).every(([k, v]) => k === 'equipment' || v === undefined);
}
