import { toListing } from '@/services/api/mappers';

const base = {
  id: 'l1', brand: 'B', model: 'M', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum',
  equipment: [], cabins: 0, engine: '', description: '', status: 'published', badges: [], photos: [],
  seller: { id: 's', name: 'S', since: 2020, companyName: null }, logbook: null, isMine: false,
};

test('öne çıkarma bilgisi ilana taşınır', () => {
  expect(toListing({ ...base, promo: { featured: true, urgent: false, featuredUntil: '2026-10-09T00:00:00Z' } } as never).promo)
    .toEqual({ featured: true, urgent: false, featuredUntil: '2026-10-09T00:00:00Z' });
  expect(toListing(base as never).promo).toEqual({ featured: false, urgent: false });
});
