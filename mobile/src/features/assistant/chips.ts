import type { TFunction } from 'i18next';
import { formatPrice } from '@/services/rates';
import type { ParsedQuery } from './parse';
import type { Criterion } from './match';

/** Ayrıştırılmış sorguyu kullanıcıya okunur çip metinlerine çevirir. */
export function queryChips(q: ParsedQuery, t: TFunction, lang: 'tr' | 'en'): string[] {
  const out: string[] = [];
  const cur = q.currency ?? 'TRY';
  if (q.type) out.push(t(`boatType.${q.type}`));
  if (q.minLength !== undefined && q.maxLength !== undefined) out.push(t('assistant.chip.lenRange', { a: q.minLength, b: q.maxLength }));
  else if (q.maxLength !== undefined) out.push(t('assistant.chip.lenMax', { n: q.maxLength }));
  else if (q.minLength !== undefined) out.push(t('assistant.chip.lenMin', { n: q.minLength }));
  if (q.minYear !== undefined && q.minYear === q.maxYear) out.push(t('assistant.chip.yearExact', { n: q.minYear }));
  else if (q.minYear !== undefined) out.push(t('assistant.chip.yearMin', { n: q.minYear }));
  else if (q.maxYear !== undefined) out.push(t('assistant.chip.yearMax', { n: q.maxYear }));
  if (q.minPrice !== undefined && q.maxPrice !== undefined)
    out.push(t('assistant.chip.priceRange', { a: formatPrice(q.minPrice, cur, lang), b: formatPrice(q.maxPrice, cur, lang) }));
  else if (q.maxPrice !== undefined) out.push(t('assistant.chip.priceMax', { p: formatPrice(q.maxPrice, cur, lang) }));
  else if (q.minPrice !== undefined) out.push(t('assistant.chip.priceMin', { p: formatPrice(q.minPrice, cur, lang) }));
  if (q.location) out.push(q.location);
  q.equipment.forEach((e) => out.push(t(`equipment.${e}`)));
  return out;
}

export function criterionLabel(c: Criterion, t: TFunction): string {
  return c.startsWith('equipment:') ? t(`equipment.${c.slice(10)}`) : t(`assistant.crit.${c}`);
}
