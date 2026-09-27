/** Öne çıkarma bitişine kalan gün (yukarı yuvarlanır); bitmişse ya da yoksa null. */
export function daysLeft(until?: string, now = new Date()): number | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 864e5) : null;
}

/** Kuruş → "₺1.499" (tam lira; ürün fiyatları kuruşsuz girilir). */
export function formatKurus(k: number, lang: 'tr' | 'en') {
  return `₺${Math.round(k / 100).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}`;
}

/** Deneme mağaza makbuzu (yalnızca PAYMENTS_MODE=dev sunucuda geçer). */
export const devReceipt = (storeProductId: string) =>
  `dev:${storeProductId}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
