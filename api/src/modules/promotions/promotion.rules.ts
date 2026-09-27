/** Öne çıkarma kuralları — saf fonksiyonlar (veritabanı ve saat dışarıdan). */
export type PromoState = { featuredUntil: Date | null; urgentUntil: Date | null; bumpedAt: Date | null };
export type PromoProduct = { kind: 'vitrin' | 'acil' | 'bump'; days: number | null };

const DAY = 864e5;
const field = (k: PromoProduct['kind']) => (k === 'vitrin' ? 'featuredUntil' : 'urgentUntil') as 'featuredUntil' | 'urgentUntil';

export const isActive = (until: Date | null, now: Date) => !!until && until.getTime() > now.getTime();

/** Süreli ürün: bitiş = max(şimdi, mevcut bitiş) + gün. Üste taşı: bumpedAt = şimdi. */
export function applyProduct(s: PromoState, p: PromoProduct, now: Date): PromoState {
  const cur = { featuredUntil: s.featuredUntil, urgentUntil: s.urgentUntil, bumpedAt: s.bumpedAt };
  if (p.kind === 'bump') return { ...cur, bumpedAt: now };
  const f = field(p.kind);
  const base = Math.max(now.getTime(), cur[f]?.getTime() ?? 0);
  return { ...cur, [f]: new Date(base + (p.days ?? 0) * DAY) };
}

/** İade: süre gün kadar geri çekilir, şimdiden geriye gitmez. Üste taşının geri alınacak etkisi yoktur. */
export function revertProduct(s: PromoState, p: PromoProduct, now: Date): PromoState {
  const cur = { featuredUntil: s.featuredUntil, urgentUntil: s.urgentUntil, bumpedAt: s.bumpedAt };
  if (p.kind === 'bump') return cur;
  const f = field(p.kind);
  if (!cur[f]) return cur;
  return { ...cur, [f]: new Date(Math.max(now.getTime(), cur[f]!.getTime() - (p.days ?? 0) * DAY)) };
}

/** "En yeni" sıralamasının anahtarı. */
export const freshness = (l: { publishedAt: Date | null; bumpedAt: Date | null }) =>
  Math.max(l.publishedAt?.getTime() ?? 0, l.bumpedAt?.getTime() ?? 0);
