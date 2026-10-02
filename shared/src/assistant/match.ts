import type { Equipment, MatchableListing } from '../filter';
import { DEMO_RATES, toTRY, type Rates } from '../rates';
import { isEmptyQuery, type ParsedQuery } from './parse';

export type Criterion = 'length' | 'year' | 'price' | 'type' | 'location' | 'engineHours' | 'flag' | 'tradeIn' | 'negotiable' | `equipment:${Equipment}`;
export interface MatchResult<L extends MatchableListing = MatchableListing> { exact: L[]; near: { listing: L; missing: Criterion[] }[] }

export function failures(l: MatchableListing, q: ParsedQuery, rates: Rates = DEMO_RATES): Criterion[] {
  const f: Criterion[] = [];
  if ((q.minLength !== undefined && l.lengthM < q.minLength) || (q.maxLength !== undefined && l.lengthM > q.maxLength)) f.push('length');
  if ((q.minYear !== undefined && l.year < q.minYear) || (q.maxYear !== undefined && l.year > q.maxYear)) f.push('year');
  const cur = q.currency ?? 'TRY';
  const price = toTRY(l.price, l.currency, rates);
  if ((q.minPrice !== undefined && price < toTRY(q.minPrice, cur, rates)) || (q.maxPrice !== undefined && price > toTRY(q.maxPrice, cur, rates))) f.push('price');
  if (q.type && l.type !== q.type) f.push('type');
  if (q.location && l.location !== q.location) f.push('location');
  if (q.maxEngineHours !== undefined && (l.engineHours == null || l.engineHours > q.maxEngineHours)) f.push('engineHours');
  if (q.flag && l.flag !== q.flag) f.push('flag');
  if (q.tradeIn && !l.tradeIn) f.push('tradeIn');
  if (q.negotiable && !l.negotiable) f.push('negotiable');
  q.equipment.forEach((e) => { if (!l.equipment.includes(e)) f.push(`equipment:${e}`); });
  return f;
}

export function matchListings<L extends MatchableListing>(listings: L[], q: ParsedQuery, rates: Rates = DEMO_RATES): MatchResult<L> {
  const live = listings.filter((l) => l.status === 'yayinda').sort((a, b) => b.year - a.year);
  if (isEmptyQuery(q)) return { exact: live, near: [] };
  const exact: L[] = [];
  const near: MatchResult<L>['near'] = [];
  for (const l of live) {
    const f = failures(l, q, rates);
    if (f.length === 0) exact.push(l);
    else if (f.length === 1 && near.length < 5) near.push({ listing: l, missing: f });
  }
  return { exact, near };
}
