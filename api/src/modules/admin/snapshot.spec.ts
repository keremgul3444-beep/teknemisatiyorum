import type { Listing } from '@prisma/client';
import { changedFields, listingSnapshot } from './snapshot';

const l = { brand: 'Bavaria', model: 'C42', year: 2020, lengthM: 12.8, type: 'yelkenli', price: 300000, currency: 'EUR', location: 'Bodrum', equipment: ['branda'], cabins: 3, engine: '', description: 'A', engineHours: null, flag: null, tradeIn: false, negotiable: false, videoUrl: null } as unknown as Listing;

test('değişen alanlar: ilk incelemede null, sonra yalnızca farklı olanlar', () => {
  const snap = listingSnapshot(l, ['f1', 'f2']);
  expect(changedFields(null, snap)).toBeNull();
  expect(changedFields(snap, snap)).toEqual([]);
  expect(changedFields(snap, listingSnapshot({ ...l, price: 280000, description: 'B' } as Listing, ['f2', 'f1']))).toEqual(['price', 'description', 'photos']);
});
