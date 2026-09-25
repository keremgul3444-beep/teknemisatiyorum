import type { Currency } from './types';

export const DEMO_RATES: Record<Currency, number> = { TRY: 1, EUR: 48, USD: 41 };
export const toTRY = (amount: number, c: Currency) => amount * DEMO_RATES[c];
export const toEUR = (amount: number, c: Currency) => toTRY(amount, c) / DEMO_RATES.EUR;

const SYM: Record<Currency, string> = { TRY: '₺', EUR: '€', USD: '$' };
export const formatPrice = (amount: number, c: Currency, lang: 'tr' | 'en') =>
  SYM[c] + Math.round(amount).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
