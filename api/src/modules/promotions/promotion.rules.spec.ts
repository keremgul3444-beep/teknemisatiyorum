import { applyProduct, freshness, isActive, revertProduct, type PromoState } from './promotion.rules';

const now = new Date('2026-10-01T12:00:00Z');
const day = 864e5;
const empty: PromoState = { featuredUntil: null, urgentUntil: null, bumpedAt: null };

test('süreli ürün şimdiden başlar; aktif süre varsa üstüne eklenir', () => {
  const a = applyProduct(empty, { kind: 'vitrin', days: 7 }, now);
  expect(a.featuredUntil!.getTime()).toBe(now.getTime() + 7 * day);
  const b = applyProduct(a, { kind: 'vitrin', days: 7 }, now);
  expect(b.featuredUntil!.getTime()).toBe(now.getTime() + 14 * day);
});

test('süresi dolmuş bitiş yok sayılır', () => {
  const old = { ...empty, urgentUntil: new Date(now.getTime() - day) };
  expect(applyProduct(old, { kind: 'acil', days: 7 }, now).urgentUntil!.getTime()).toBe(now.getTime() + 7 * day);
});

test('üste taşı yalnızca bumpedAt değiştirir', () => {
  const s = applyProduct(empty, { kind: 'bump', days: null }, now);
  expect(s).toEqual({ featuredUntil: null, urgentUntil: null, bumpedAt: now });
});

test('iade süreyi geri çeker ama şimdiden geriye gitmez', () => {
  const s = { ...empty, featuredUntil: new Date(now.getTime() + 10 * day) };
  expect(revertProduct(s, { kind: 'vitrin', days: 7 }, now).featuredUntil!.getTime()).toBe(now.getTime() + 3 * day);
  expect(revertProduct(s, { kind: 'vitrin', days: 30 }, now).featuredUntil!.getTime()).toBe(now.getTime());
});

test('aktiflik ve tazelik', () => {
  expect(isActive(null, now)).toBe(false);
  expect(isActive(new Date(now.getTime() + 1), now)).toBe(true);
  expect(isActive(now, now)).toBe(false);
  const p = new Date('2026-09-01'); const b = new Date('2026-09-20');
  expect(freshness({ publishedAt: p, bumpedAt: b })).toBe(b.getTime());
  expect(freshness({ publishedAt: p, bumpedAt: null })).toBe(p.getTime());
});

import { resumePromo } from './promotion.rules';
test('süresi dolan ilan yeniden yayına girince geçerli vitrin/acil süresi aradaki gün kadar uzar', () => {
  const d = (s: string) => new Date(s);
  const expiredAt = d('2026-10-01T00:00:00Z');
  const now = d('2026-10-04T00:00:00Z');
  const r = resumePromo({ featuredUntil: d('2026-10-05T00:00:00Z'), urgentUntil: d('2026-09-30T00:00:00Z') }, expiredAt, now);
  expect(r.featuredUntil).toEqual(d('2026-10-08T00:00:00Z'));
  expect(r.urgentUntil).toBeUndefined();
  expect(resumePromo({ featuredUntil: d('2026-10-05T00:00:00Z'), urgentUntil: null }, d('2026-10-10T00:00:00Z'), now)).toEqual({});
  expect(resumePromo({ featuredUntil: null, urgentUntil: null }, null, now)).toEqual({});
});
