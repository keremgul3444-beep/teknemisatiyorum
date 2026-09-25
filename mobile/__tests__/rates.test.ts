import { toTRY, formatPrice } from '@/services/rates';

test('kur dönüşümü', () => {
  expect(toTRY(100, 'EUR')).toBe(4800);
  expect(toTRY(100, 'TRY')).toBe(100);
});

test('fiyat biçimi', () => {
  expect(formatPrice(285000, 'EUR', 'tr')).toBe('€285.000');
  expect(formatPrice(285000, 'EUR', 'en')).toBe('€285,000');
});
