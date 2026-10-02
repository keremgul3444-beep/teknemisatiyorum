import '@/i18n';
import i18n from 'i18next';
import { makeListings } from '@tms/shared';
import { compareRows } from '@/features/compare';
import type { Listing } from '@/services/types';

beforeAll(() => i18n.changeLanguage('tr'));
const base = makeListings();
const L = (over: Partial<Listing>): Listing => ({ ...base[0], ...over } as Listing);

test('her satırda en iyi değer işaretlenir: en düşük fiyat (kur çevrilerek), en yeni yıl, en uzun boy', () => {
  const rows = compareRows([
    L({ id: 'a', price: 100000, currency: 'EUR', year: 2015, lengthM: 12, cabins: 3, equipment: ['branda'], logbookCount: 2 }),
    L({ id: 'b', price: 3000000, currency: 'TRY', year: 2020, lengthM: 11, cabins: 3, equipment: ['branda', 'klima'], logbookCount: 9 }),
  ], i18n.t, 'tr');
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  expect(by.price.best).toBe(1); // 3.000.000 TL, 100.000 EUR'dan ucuz
  expect(by.year.best).toBe(1);
  expect(by.length.best).toBe(0);
  expect(by.cabins.best).toBeNull(); // eşit
  expect(by.equipment.best).toBe(1);
  expect(by.logbook.best).toBe(1);
  expect(by.type.best).toBeNull(); // metin satırı
  expect(by.price.values[0]).toBe('€100.000');
  expect(by.equipment.values[1]).toBe('Branda, Klima');
});

test('tek ilan ya da boş alanlarda çökmez', () => {
  const rows = compareRows([L({ id: 'a', engine: '', equipment: [], badges: [] })], i18n.t, 'en');
  expect(rows.every((r) => r.best === null)).toBe(true);
  expect(rows.find((r) => r.key === 'engine')!.values).toEqual(['—']);
});

test('motor saati azı iyi; bayrak ve satış koşulları gösterilir', () => {
  const rows = compareRows([
    L({ id: 'a', engineHours: 1200, flag: 'tr', tradeIn: true, negotiable: true }),
    L({ id: 'b', engineHours: 400, flag: 'foreign', tradeIn: false, negotiable: false }),
    L({ id: 'c', engineHours: null, flag: null }),
  ], i18n.t, 'tr');
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  expect(by.engineHours.best).toBe(1);
  expect(by.engineHours.values).toEqual(['1.200 saat', '400 saat', '—']);
  expect(by.flag.values).toEqual(['Türk bayraklı', 'Yabancı bayraklı', '—']);
  expect(by.terms.values).toEqual(['Takasa açık, Pazarlık payı var', '—', '—']);
});
