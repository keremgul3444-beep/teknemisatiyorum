import { daysLeft, devReceipt, formatKurus } from '@/features/promo';

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
