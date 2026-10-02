import type { LogbookEntry, PriceHistory } from '@prisma/client';
import { priceDropOf, priceNeedsReview, publicEntries } from './listing.view';

const DAY = 864e5;
const now = new Date('2026-10-02T12:00:00Z');
const h = (price: number, daysAgo: number, currency = 'EUR'): PriceHistory =>
  ({ id: `h${price}${daysAgo}`, listingId: 'l', price, currency, at: new Date(now.getTime() - daysAgo * DAY) }) as PriceHistory;
const drop = (price: number, history: PriceHistory[]) => priceDropOf({ price, currency: 'EUR', priceHistory: history }, now);

describe('fiyat düştü', () => {
  test('gerçek indirim: önceki fiyat gösterilir', () => {
    expect(drop(90000, [h(100000, 1)])).toMatchObject({ previousPrice: 100000 });
  });

  test('önce artırıp sonra indirmek rozet vermez; referans son 60 günün en düşük fiyatıdır', () => {
    // 100.000 → 200.000 (5 gün önce) → 150.000 (bugün)
    expect(drop(150000, [h(200000, 0), h(100000, 5)])).toBeNull();
    // 100.000 → 200.000 → 95.000: indirim var ama "önceki fiyat" 100.000
    expect(drop(95000, [h(200000, 0), h(100000, 5)])).toMatchObject({ previousPrice: 100000 });
    // 60 günden eski yüksek fiyat referans dışı
    expect(drop(95000, [h(120000, 0), h(90000, 80)])).toMatchObject({ previousPrice: 120000 });
  });

  test('30 günden eski indirim, artış ve başka para birimi rozet vermez', () => {
    expect(drop(90000, [h(100000, 40)])).toBeNull();
    expect(drop(110000, [h(100000, 1)])).toBeNull();
    expect(drop(90000, [h(100000, 1, 'TRY')])).toBeNull();
    expect(drop(90000, [])).toBeNull();
  });
});

test('ölçüsüz fiyat değişikliği onaya düşer', () => {
  expect(priceNeedsReview(100000, 90000)).toBe(false);
  expect(priceNeedsReview(100000, 150000)).toBe(false);
  expect(priceNeedsReview(100000, 49000)).toBe(true);
  expect(priceNeedsReview(100000, 1)).toBe(true);
  expect(priceNeedsReview(100000, 151000)).toBe(true);
});

test('onaydan sonra yazılan doğrulanmamış karne kaydı yalnızca sahibine görünür', () => {
  const e = (id: string, createdDaysAgo: number, verified = false) =>
    ({ id, boatId: 'b', kind: 'bakim', date: now, title: id, byName: 'x', verified, sourceRef: null, createdAt: new Date(now.getTime() - createdDaysAgo * DAY) }) as LogbookEntry;
  const l = { ownerId: 'o', publishedAt: new Date(now.getTime() - 5 * DAY), boat: { id: 'b', _count: { entries: 3 }, entries: [e('sonra', 1), e('dogrulu', 1, true), e('once', 10)] } };
  expect(publicEntries(l, 'misafir').map((x) => x.id)).toEqual(['dogrulu', 'once']);
  expect(publicEntries(l, 'o').map((x) => x.id)).toEqual(['sonra', 'dogrulu']);
  expect(publicEntries({ ...l, publishedAt: null }, undefined).map((x) => x.id)).toEqual(['dogrulu']);
});
