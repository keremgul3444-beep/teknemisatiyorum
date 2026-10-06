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

/**
 * Süresi dolan ilan yeniden yayına girince: süresi dolduğu anda hâlâ geçerli olan vitrin/acil süresi, ilanın
 * yayında olmadığı süre kadar uzatılır (satıcının ödediği gün görünmeden harcanmasın).
 */
export function resumePromo(s: Pick<PromoState, 'featuredUntil' | 'urgentUntil'>, expiredAt: Date | null, now: Date): Partial<PromoState> {
  if (!expiredAt || expiredAt.getTime() >= now.getTime()) return {};
  const gap = now.getTime() - expiredAt.getTime();
  const out: Partial<PromoState> = {};
  for (const f of ['featuredUntil', 'urgentUntil'] as const) {
    const u = s[f];
    if (u && u.getTime() > expiredAt.getTime()) out[f] = new Date(u.getTime() + gap);
  }
  return out;
}
