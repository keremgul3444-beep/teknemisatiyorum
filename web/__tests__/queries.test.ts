import { expect, test } from 'vitest';
import { cityFromSlug, citySlug, landingQuery, queryToSearchParams, searchParamsToQuery } from '../src/lib/queries';

test('adres ↔ sorgu', () => {
  const s = searchParamsToQuery({ tip: 'yelkenli', sehir: 'Bodrum', minBoy: '10', maxFiyat: '200000', para: 'EUR', sira: 'asc', sayfa: '2', acil: '1', dusen: '1', donanim: 'jenerator,klima' });
  expect(s).toEqual({ q: { equipment: ['jenerator', 'klima'], type: 'yelkenli', location: 'Bodrum', minLength: 10, maxPrice: 200000, currency: 'EUR' }, sort: 'asc', page: 2, urgent: true, drop: true });
  expect(searchParamsToQuery(queryToSearchParams(s))).toEqual(s);
});

test('geçersiz parametreler hata değil, yok sayılır', () => {
  expect(searchParamsToQuery({ sayfa: 'abc', tip: 'uzay-gemisi', minBoy: '-5x', donanim: 'ucan-halı' })).toEqual({ q: { equipment: [] }, sort: 'new', page: 1, urgent: false, drop: false });
});

test('şehir adresleri', () => {
  expect(citySlug('Göcek')).toBe('gocek');
  expect(cityFromSlug('gocek', ['Bodrum', 'Göcek'])).toBe('Göcek');
  expect(cityFromSlug('mars', ['Bodrum'])).toBeNull();
  expect(landingQuery('yelkenli', 'Bodrum')).toEqual({ equipment: [], type: 'yelkenli', location: 'Bodrum' });
});
