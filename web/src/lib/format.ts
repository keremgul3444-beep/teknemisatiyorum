import { formatPrice as fp, type Currency } from '@tms/shared';
import type { Locale } from '@/i18n';

export const formatPrice = (amount: number, currency: Currency, locale: Locale) => fp(amount, currency, locale);

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u' };

/** Adres parçası: Türkçe karakterler sadeleşir, harf/rakam dışı tireye döner. */
export const slugPart = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/i̇/g, 'i').replace(/[çğıöşü]/g, (c) => TR[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** `marka-model-yil-<id>`; id sonda (cuid tire içermez). */
export const listingSlug = (l: { brand: string; model: string; year: number; id: string }) => `${slugPart(`${l.brand} ${l.model}`)}-${l.year}-${l.id}`;
export const idFromSlug = (slug: string) => slug.slice(slug.lastIndexOf('-') + 1);

/** API'nin ürettiği WebP genişlikleri; site `/media`'yı API'ye yeniden yazar. */
export const mediaUrl = (fileId: string, w: 400 | 800 | 1600) => `/media/${fileId}?w=${w}`;

/** Kuruş → "₺1.499"; kuruşlu tutar iki haneyle "₺1.499,90". */
export const formatKurus = (k: number, locale: Locale) =>
  `₺${(k / 100).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: k % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
