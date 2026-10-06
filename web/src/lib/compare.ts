import { toTRY, type Rates } from '@tms/shared';
import { formatPrice } from './format';
import type { ListingView } from './types';

export const COMPARE_MAX = 3;
export type CompareRow = { key: string; label: string; values: string[]; /** En iyi değerin sütunu (eşitlikte yok). */ best: number | null };
type T = (key: string, p?: Record<string, string | number>) => string;

/** Uygulamadaki karşılaştırmanın aynısı: sayısal satırda tek en iyi sütun; eşitlik ya da eksik değerde vurgu yok. */
function bestIndex(nums: (number | null)[], prefer: 'min' | 'max'): number | null {
  const valid = nums.flatMap((n, i) => (n === null ? [] : [[n, i] as const]));
  if (valid.length < 2) return null;
  const target = prefer === 'min' ? Math.min(...valid.map((v) => v[0])) : Math.max(...valid.map((v) => v[0]));
  const winners = valid.filter((v) => v[0] === target);
  return winners.length === 1 ? winners[0][1] : null;
}

export function compareRows(ls: ListingView[], t: T, locale: 'tr' | 'en', rates: Rates): CompareRow[] {
  const nf = (n: number) => n.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');
  const row = (key: string, values: string[], nums?: (number | null)[], prefer: 'min' | 'max' = 'max'): CompareRow =>
    ({ key, label: t(`compare.row.${key}`), values, best: nums ? bestIndex(nums, prefer) : null });
  return [
    row('price', ls.map((l) => formatPrice(l.price, l.currency, locale)), ls.map((l) => toTRY(l.price, l.currency, rates)), 'min'),
    row('year', ls.map((l) => String(l.year)), ls.map((l) => l.year)),
    row('length', ls.map((l) => `${nf(l.lengthM)} m`), ls.map((l) => l.lengthM)),
    row('type', ls.map((l) => t(`boatType.${l.type}`))),
    row('cabins', ls.map((l) => String(l.cabins ?? 0)), ls.map((l) => l.cabins ?? 0)),
    row('engine', ls.map((l) => l.engine || '—')),
    row('engineHours', ls.map((l) => (l.engineHours != null ? t('listing.engineHoursValue', { hours: nf(l.engineHours) }) : '—')), ls.map((l) => l.engineHours ?? null), 'min'),
    row('flag', ls.map((l) => (l.flag ? t(l.flag === 'tr' ? 'listing.flagTr' : 'listing.flagForeign') : '—'))),
    row('terms', ls.map((l) => [l.tradeIn ? t('listing.tradeIn') : '', l.negotiable ? t('listing.negotiable') : ''].filter(Boolean).join(', ') || '—')),
    row('location', ls.map((l) => l.location)),
    row('equipment', ls.map((l) => (l.equipment.length ? l.equipment.map((e) => t(`equipment.${e}`)).join(', ') : '—')), ls.map((l) => l.equipment.length)),
    row('badges', ls.map((l) => (l.badges.length ? l.badges.map((b) => t(`badge.${b}`)).join(', ') : '—')), ls.map((l) => l.badges.length)),
    row('logbook', ls.map((l) => String(l.logbook?.count ?? 0)), ls.map((l) => l.logbook?.count ?? 0)),
  ];
}
