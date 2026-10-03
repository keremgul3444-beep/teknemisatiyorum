import { daysLeft, devReceipt, formatKurus, kurusToInput, parseLira } from '@/features/promo';

test('kalan gün yukarı yuvarlanır; geçmiş/eksik bitiş null', () => {
  const now = new Date('2026-10-01T12:00:00Z');
  expect(daysLeft('2026-10-03T13:00:00Z', now)).toBe(3);
  expect(daysLeft('2026-09-30T00:00:00Z', now)).toBeNull();
  expect(daysLeft(undefined, now)).toBeNull();
});

test('kuruş biçimi', () => {
  expect(formatKurus(149900, 'tr')).toBe('₺1.499');
  expect(formatKurus(100, 'en')).toBe('₺1');
});

test('deneme makbuzu sunucunun beklediği biçimde', () => {
  expect(devReceipt('tms.vitrin_7')).toMatch(/^dev:tms\.vitrin_7:[\w-]{6,}$/);
});

test('kuruşlu fiyat: gösterim iki haneli, giriş virgül ya da noktayla', () => {
  expect(formatKurus(149990, 'tr')).toBe('₺1.499,90');
  expect(formatKurus(149905, 'en')).toBe('₺1,499.05');
  expect(parseLira('1499')).toBe(149900);
  expect(parseLira('1499,9')).toBe(149990);
  expect(parseLira('1499.05')).toBe(149905);
  expect(parseLira('1.499,90')).toBeNull();
  expect(parseLira('abc')).toBeNull();
  expect(kurusToInput(149900)).toBe('1499');
  expect(kurusToInput(149905)).toBe('1499,05');
});
