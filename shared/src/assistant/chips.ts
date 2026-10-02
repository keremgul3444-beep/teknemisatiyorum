import { formatPrice } from '../rates';

/** i18next'e bağımlı olmamak için asgari çeviri fonksiyonu tipi. */
export type TFunction = (key: string, params?: Record<string, unknown>) => string;
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
  if (q.maxEngineHours !== undefined) out.push(t('assistant.chip.hoursMax', { n: q.maxEngineHours }));
  if (q.flag) out.push(t(q.flag === 'tr' ? 'assistant.chip.flagTr' : 'assistant.chip.flagForeign'));
  if (q.tradeIn) out.push(t('assistant.chip.tradeIn'));
  if (q.negotiable) out.push(t('assistant.chip.negotiable'));
  q.equipment.forEach((e) => out.push(t(`equipment.${e}`)));
  return out;
}

export function criterionLabel(c: Criterion, t: TFunction): string {
  return c.startsWith('equipment:') ? t(`equipment.${c.slice(10)}`) : t(`assistant.crit.${c}`);
}

const TYPE_WORD = { motoryat: 'motoryat', yelkenli: 'yelkenli', katamaran: 'katamaran', gulet: 'gulet', surat: 'sürat', balikci: 'balıkçı' } as const;
const EQUIP_WORD = { jenerator: 'jeneratör', branda: 'branda', klima: 'klima', radar: 'radar', otopilot: 'otopilot', bowThruster: 'baş pervane', teak: 'tik güverte', tender: 'tender' } as const;
const CUR_WORD = { TRY: 'tl', EUR: 'euro', USD: 'dolar' } as const;

/** Filtreyi, parseQuery'nin aynen geri okuyabileceği bir arama cümlesine çevirir (kayıtlı aramalar için). */
export function queryToText(q: ParsedQuery): string {
  const parts: string[] = [];
  if (q.type) parts.push(TYPE_WORD[q.type]);
  if (q.minLength !== undefined && q.maxLength !== undefined) parts.push(`${q.minLength}-${q.maxLength} metre`);
  else if (q.maxLength !== undefined) parts.push(`${q.maxLength} metreye kadar`);
  else if (q.minLength !== undefined) parts.push(`${q.minLength} metre üstü`);
  if (q.minYear !== undefined && q.maxYear !== undefined) parts.push(q.minYear === q.maxYear ? `${q.minYear} model` : `${q.minYear}-${q.maxYear}`);
  else if (q.minYear !== undefined) parts.push(`${q.minYear} sonrası`);
  else if (q.maxYear !== undefined) parts.push(`${q.maxYear} öncesi`);
  const cur = CUR_WORD[q.currency ?? 'TRY'];
  if (q.maxPrice !== undefined) parts.push(`${q.maxPrice} ${cur} altı`);
  else if (q.minPrice !== undefined) parts.push(`${q.minPrice} ${cur} üstü`);
  if (q.location) parts.push(q.location);
  if (q.maxEngineHours !== undefined) parts.push(`${q.maxEngineHours} motor saati altı`);
  if (q.flag) parts.push(q.flag === 'tr' ? 'türk bayraklı' : 'yabancı bayraklı');
  if (q.tradeIn) parts.push('takas');
  if (q.negotiable) parts.push('pazarlık');
  q.equipment.forEach((e) => parts.push(EQUIP_WORD[e]));
  return parts.join(' ');
}
