import { BOAT_TYPES, EQUIPMENT, parsedQuerySchema, type BoatType, type Equipment, type ParsedQuery } from '@tms/shared';
import { slugPart } from './format';

export type Sort = 'new' | 'asc' | 'desc';
export type SearchState = { q: ParsedQuery; sort: Sort; page: number; urgent: boolean; drop?: boolean };
type SP = Record<string, string | undefined>;

export const TYPE_SLUGS = Object.fromEntries(BOAT_TYPES.map((t) => [t, t])) as Record<BoatType, string>;
export const isBoatType = (s: string): s is BoatType => (BOAT_TYPES as readonly string[]).includes(s);
export const citySlug = slugPart;
export const cityFromSlug = (slug: string, known: string[]) => known.find((c) => citySlug(c) === slug) ?? null;
export const landingQuery = (type: string, city?: string): ParsedQuery => ({ equipment: [], type: type as BoatType, ...(city ? { location: city } : {}) });

const num = (v?: string) => (v !== undefined && v !== '' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);

/** Adres parametreleri (Türkçe adlar) → doğrulanmış sorgu. Geçersiz alan hata değil, yok sayılır. */
export function searchParamsToQuery(sp: SP): SearchState {
  const raw: Record<string, unknown> = {
    type: sp.tip, location: sp.sehir, currency: sp.para,
    minLength: num(sp.minBoy), maxLength: num(sp.maxBoy), minYear: num(sp.minYil), maxYear: num(sp.maxYil), maxPrice: num(sp.maxFiyat),
  };
  const q: Record<string, unknown> = {
    equipment: (sp.donanim ?? '').split(',').filter((e): e is Equipment => (EQUIPMENT as readonly string[]).includes(e)),
  };
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === '') continue;
    const r = parsedQuerySchema.safeParse({ equipment: [], [k]: v });
    if (r.success) q[k] = (r.data as Record<string, unknown>)[k];
  }
  const sort: Sort = sp.sira === 'asc' || sp.sira === 'desc' ? sp.sira : 'new';
  const p = Number(sp.sayfa);
  return { q: q as ParsedQuery, sort, page: Number.isInteger(p) && p >= 1 && p <= 500 ? p : 1, urgent: sp.acil === '1', drop: sp.dusen === '1' };
}

export function queryToSearchParams(s: SearchState): Record<string, string> {
  const q = s.q;
  const out: SP = {
    tip: q.type, sehir: q.location, para: q.currency,
    minBoy: q.minLength?.toString(), maxBoy: q.maxLength?.toString(), minYil: q.minYear?.toString(), maxYil: q.maxYear?.toString(),
    maxFiyat: q.maxPrice?.toString(), donanim: q.equipment.length ? q.equipment.join(',') : undefined,
    sira: s.sort === 'new' ? undefined : s.sort, sayfa: s.page > 1 ? String(s.page) : undefined, acil: s.urgent ? '1' : undefined, dusen: s.drop ? '1' : undefined,
  };
  return Object.fromEntries(Object.entries(out).filter((e): e is [string, string] => e[1] !== undefined));
}

/** API sorgu dizesi (`/listings?...`). */
export function apiListingsPath(s: SearchState) {
  const p = new URLSearchParams({ q: JSON.stringify(s.q), sort: s.sort, page: String(s.page) });
  if (s.urgent) p.set('urgent', '1');
  if (s.drop) p.set('drop', '1');
  return `/listings?${p.toString()}`;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;
/** Çoklu değerli parametreler (donanım onay kutuları) virgüllü tek değere indirgenir. */
export const flatten = (sp: RawSearchParams): SP => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]));
