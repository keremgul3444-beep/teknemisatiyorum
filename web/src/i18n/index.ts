import tr from './tr.json';
import en from './en.json';

export type Locale = 'tr' | 'en';
export const LOCALES: Locale[] = ['tr', 'en'];
const dicts: Record<Locale, unknown> = { tr, en };

export const isLocale = (s: string): s is Locale => (LOCALES as string[]).includes(s);

/** Anahtar → metin; `{{ad}}` parametreleri doldurulur. Eksik anahtar geliştirmede hata, üretimde anahtarın kendisi. */
export function t(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dicts[locale]);
  if (typeof v !== 'string') {
    if (process.env.NODE_ENV !== 'production') throw new Error(`Çeviri yok: ${locale}.${key}`);
    return key;
  }
  return v.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
}

/** Bir anahtar altındaki metin listesi (ör. adımlar). */
export function tList(locale: Locale, key: string): string[] {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dicts[locale]);
  return Array.isArray(v) ? (v as string[]) : [];
}

/** Başlık/gövde çiftlerinden oluşan bölüm listesi (sabit sayfalar). */
export function tSections(locale: Locale, key: string): { h: string; b: string }[] {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dicts[locale]);
  return Array.isArray(v) ? (v as { h: string; b: string }[]).filter((s) => typeof s?.h === 'string' && typeof s?.b === 'string') : [];
}

/** TR öneksiz, EN `/en` önekli. */
export const localePath = (locale: Locale, p: string) => (locale === 'tr' ? p : p === '/' ? '/en' : `/en${p}`);
