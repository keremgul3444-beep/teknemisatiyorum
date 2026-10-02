import type { TFunction } from 'i18next';
import type { Listing } from '@/services/types';
import { formatPrice, toTRY } from '@/services';

export const COMPARE_MAX = 3;

export interface CompareRow { key: string; label: string; values: string[]; /** En iyi değerin sütunu (eşitlikte yok). */ best: number | null }

/** Sayısal satırda tek bir en iyi sütun; eşitlik ya da eksik değer varsa vurgulanmaz. */
function bestIndex(nums: (number | null)[], prefer: 'min' | 'max'): number | null {
  const valid = nums.map((n, i) => (n === null ? null : [n, i] as const)).filter((x): x is readonly [number, number] => x !== null);
  if (valid.length < 2) return null;
  const target = prefer === 'min' ? Math.min(...valid.map((v) => v[0])) : Math.max(...valid.map((v) => v[0]));
  const winners = valid.filter((v) => v[0] === target);
  return winners.length === 1 ? winners[0][1] : null;
}

/** Karşılaştırma tablosu: her satır bir özellik, her sütun bir ilan; en iyi değer işaretli. */
export function compareRows(listings: Listing[], t: TFunction, lang: 'tr' | 'en'): CompareRow[] {
  const row = (key: string, values: string[], nums?: (number | null)[], prefer: 'min' | 'max' = 'max'): CompareRow =>
    ({ key, label: t(`compare.row.${key}`), values, best: nums ? bestIndex(nums, prefer) : null });
  return [
    row('price', listings.map((l) => formatPrice(l.price, l.currency, lang)), listings.map((l) => toTRY(l.price, l.currency)), 'min'),
    row('year', listings.map((l) => String(l.year)), listings.map((l) => l.year)),
    row('length', listings.map((l) => `${l.lengthM.toLocaleString(lang)} m`), listings.map((l) => l.lengthM)),
    row('type', listings.map((l) => t(`boatType.${l.type}`))),
    row('cabins', listings.map((l) => String(l.cabins)), listings.map((l) => l.cabins)),
    row('engine', listings.map((l) => l.engine || '—')),
    // Motor saati: az olan iyi; bilinmeyen değer vurgulanmaz.
    row('engineHours', listings.map((l) => (l.engineHours != null ? t('listing.engineHoursValue', { hours: l.engineHours.toLocaleString(lang) }) : '—')),
      listings.map((l) => l.engineHours ?? null), 'min'),
    row('flag', listings.map((l) => (l.flag ? t(l.flag === 'tr' ? 'listing.flagTr' : 'listing.flagForeign') : '—'))),
    row('terms', listings.map((l) => [l.tradeIn ? t('listing.tradeIn') : '', l.negotiable ? t('listing.negotiable') : ''].filter(Boolean).join(', ') || '—')),
    row('location', listings.map((l) => l.location)),
    row('equipment', listings.map((l) => (l.equipment.length ? l.equipment.map((e) => t(`equipment.${e}`)).join(', ') : '—')), listings.map((l) => l.equipment.length)),
    row('badges', listings.map((l) => (l.badges.length ? l.badges.map((b) => t(`badge.${b}`)).join(', ') : '—')), listings.map((l) => l.badges.length)),
    row('logbook', listings.map((l) => String(l.logbookCount)), listings.map((l) => l.logbookCount)),
  ];
}
