import { expect, test } from 'vitest';
import { resolveLanding } from '../src/lib/landing';

const map = { listings: [], facets: [{ type: 'yelkenli', location: null, count: 5 }, { type: 'yelkenli', location: 'Göcek', count: 4 }] };

test('hazır arama: bilinmeyen tip/şehir bulunamadı; bilinen için sayı', () => {
  expect(resolveLanding(map, 'uzay')).toEqual({ kind: 'notFound' });
  expect(resolveLanding(map, 'yelkenli', 'mars')).toEqual({ kind: 'notFound' });
  expect(resolveLanding(map, 'yelkenli', 'gocek')).toEqual({ kind: 'ok', tip: 'yelkenli', city: 'Göcek', count: 4 });
  expect(resolveLanding(map, 'gulet')).toEqual({ kind: 'ok', tip: 'gulet', city: null, count: 0 });
});

test('API kapalıyken (veri yok) "bulunamadı" denmez: hata yükselir, önbellekteki sayfa sunulmaya devam eder', () => {
  expect(() => resolveLanding(null, 'yelkenli', 'gocek')).toThrow();
});
