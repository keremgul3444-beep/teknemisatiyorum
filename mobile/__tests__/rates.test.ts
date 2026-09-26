import { toTRY, formatPrice } from '@/services/rates';

test('kur dönüşümü', () => {
  expect(toTRY(100, 'EUR')).toBe(4800);
  expect(toTRY(100, 'TRY')).toBe(100);
});

test('fiyat biçimi', () => {
  expect(formatPrice(285000, 'EUR', 'tr')).toBe('€285.000');
  expect(formatPrice(285000, 'EUR', 'en')).toBe('€285,000');
});

test('gerçek modda sunucu kurları kullanılır; demoya dönünce örnek kurlar', () => {
  const { setRates, resetRates, toEUR } = jest.requireActual('@/services/rates');
  setRates({ TRY: 1, EUR: 50, USD: 40 });
  expect(toTRY(100, 'EUR')).toBe(5000);
  expect(toEUR(5000, 'TRY')).toBe(100);
  resetRates();
  expect(toTRY(100, 'EUR')).toBe(4800);
});
