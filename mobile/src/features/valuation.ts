import type { BoatType, Listing } from '@/services/types';
import { toEUR } from '@/services/rates';

export interface ValuationInput { type: BoatType; year: number; lengthM: number }
export interface Valuation { lowEUR: number; highEUR: number; comparables: Listing[] }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Benzer ilanların metre başı fiyatını, yaş farkı başına %3 düzeltip medyanını alır. */
export function estimateValue(input: ValuationInput, listings: Listing[]): Valuation {
  const comparables = listings.filter((l) =>
    l.status === 'yayinda' && l.type === input.type && Math.abs(l.lengthM - input.lengthM) <= 3 && Math.abs(l.year - input.year) <= 5);
  if (comparables.length === 0) return { lowEUR: 0, highEUR: 0, comparables: [] };
  const perMeter = comparables.map((l) => (toEUR(l.price, l.currency) / l.lengthM) * (1 + 0.03 * (input.year - l.year)));
  const mid = median(perMeter) * input.lengthM;
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return { lowEUR: round(mid * 0.9), highEUR: round(mid * 1.1), comparables };
}
