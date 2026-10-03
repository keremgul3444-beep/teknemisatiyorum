/** Öne çıkarma bitişine kalan gün (yukarı yuvarlanır); bitmişse ya da yoksa null. */
export function daysLeft(until?: string, now = new Date()): number | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / 864e5) : null;
}

/** Kuruş → "₺1.499"; kuruşlu tutar iki haneyle "₺1.499,90". */
export function formatKurus(k: number, lang: 'tr' | 'en') {
  const whole = k % 100 === 0;
  return `₺${(k / 100).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Yönetim fiyat girişi: "1499", "1499,90" ya da "1499.9" → kuruş; geçersizse null. Binlik ayracı kabul edilmez. */
export function parseLira(s: string): number | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Kuruş → giriş kutusu metni: "1499" ya da "1499,90". */
export const kurusToInput = (k: number) => (k % 100 === 0 ? String(k / 100) : `${Math.floor(k / 100)},${String(k % 100).padStart(2, '0')}`);

/** Deneme mağaza makbuzu (yalnızca PAYMENTS_MODE=dev sunucuda geçer). */
export const devReceipt = (storeProductId: string) =>
  `dev:${storeProductId}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
