import type { Equipment, Listing } from '@/services/types';
import { toTRY } from '@/services/rates';
import { isEmptyQuery, type ParsedQuery } from './parse';

export type Criterion = 'length' | 'year' | 'price' | 'type' | 'location' | `equipment:${Equipment}`;
export interface MatchResult { exact: Listing[]; near: { listing: Listing; missing: Criterion[] }[] }

export function failures(l: Listing, q: ParsedQuery): Criterion[] {
  const f: Criterion[] = [];
  if ((q.minLength !== undefined && l.lengthM < q.minLength) || (q.maxLength !== undefined && l.lengthM > q.maxLength)) f.push('length');
  if ((q.minYear !== undefined && l.year < q.minYear) || (q.maxYear !== undefined && l.year > q.maxYear)) f.push('year');
  const cur = q.currency ?? 'TRY';
  const price = toTRY(l.price, l.currency);
  if ((q.minPrice !== undefined && price < toTRY(q.minPrice, cur)) || (q.maxPrice !== undefined && price > toTRY(q.maxPrice, cur))) f.push('price');
  if (q.type && l.type !== q.type) f.push('type');
  if (q.location && l.location !== q.location) f.push('location');
  q.equipment.forEach((e) => { if (!l.equipment.includes(e)) f.push(`equipment:${e}`); });
  return f;
}

export function matchListings(listings: Listing[], q: ParsedQuery): MatchResult {
  const live = listings.filter((l) => l.status === 'yayinda').sort((a, b) => b.year - a.year);
  if (isEmptyQuery(q)) return { exact: live, near: [] };
  const exact: Listing[] = [];
  const near: MatchResult['near'] = [];
  for (const l of live) {
    const f = failures(l, q);
    if (f.length === 0) exact.push(l);
    else if (f.length === 1 && near.length < 5) near.push({ listing: l, missing: f });
  }
  return { exact, near };
}
