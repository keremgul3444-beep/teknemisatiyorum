import type { Locale } from '@/i18n';

/**
 * Ödemeye gidilecek adres: yalnızca sitenin kendisi ya da tanımlı ödeme sağlayıcısı (yoksa `null`).
 * Sitenin kendi deneme ödeme sayfası kullanıcının dilinde açılır (EN → `/en` öneki).
 */
export function checkoutTarget(raw: string, origin: string, locale: Locale, paymentOrigin?: string): string | null {
  const url = new URL(raw, origin);
  if (url.origin === origin) {
    if (locale === 'en' && url.pathname !== '/en' && !url.pathname.startsWith('/en/')) url.pathname = `/en${url.pathname}`;
    return url.toString();
  }
  return paymentOrigin && url.origin === paymentOrigin ? url.toString() : null;
}
