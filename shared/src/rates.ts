import type { Currency } from './filter';

export type Rates = Record<Currency, number>;
export const DEMO_RATES: Rates = { TRY: 1, EUR: 48, USD: 41 };
export const toTRY = (amount: number, c: Currency, rates: Rates = DEMO_RATES) => amount * rates[c];
export const toEUR = (amount: number, c: Currency, rates: Rates = DEMO_RATES) => toTRY(amount, c, rates) / rates.EUR;

const SYM: Record<Currency, string> = { TRY: '₺', EUR: '€', USD: '$' };
export const formatPrice = (amount: number, c: Currency, lang: 'tr' | 'en') =>
  SYM[c] + Math.round(amount).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
