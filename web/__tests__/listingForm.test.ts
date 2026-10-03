import { expect, test } from 'vitest';
import { emptySell, firstInvalid, move, restoreSell, toCover, toDraft, validateSell, type SellFields } from '../src/lib/listingForm';

const filled = (): SellFields => ({
  ...emptySell(), brand: 'Bavaria', model: 'Cruiser 41', year: '2016', length: '12,4', type: 'yelkenli', engineHours: '850',
  price: '149.000', location: 'Bodrum', flag: 'tr', tradeIn: true,
});

test('adımlar alan alan doğrulanır', () => {
  expect(validateSell(0, emptySell(), 0)).toEqual({ photos: 'photos' });
  expect(validateSell(1, emptySell(), 1)).toEqual({ brand: 'required', model: 'required', year: 'required', length: 'required', type: 'type' });
  const now = new Date('2026-10-03');
  expect(validateSell(1, { ...filled(), year: '2028' }, 1, now).year).toBe('year');
  expect(validateSell(1, { ...filled(), length: '1,5' }, 1, now).length).toBe('length');
  expect(validateSell(1, { ...filled(), engineHours: '250000' }, 1, now).engineHours).toBe('engineHours');
  expect(validateSell(3, emptySell(), 1)).toEqual({ price: 'price', location: 'location' });
  expect(firstInvalid(filled(), 2, now)).toBe(-1);
  expect(firstInvalid(filled(), 0, now)).toBe(0);
});

test('taslak sunucu biçimine çevrilir', () => {
  expect(toDraft(filled())).toMatchObject({ brand: 'Bavaria', year: 2016, lengthM: 12.4, price: 149000, type: 'yelkenli', engineHours: 850, flag: 'tr', tradeIn: true, negotiable: false });
  expect(toDraft({ ...filled(), engineHours: '', flag: '' })).toMatchObject({ engineHours: null, flag: null });
});

test('fotoğraf sırası ve kapak', () => {
  expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  expect(toCover(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b']);
});

test('saklanan taslak geri gelir; bozuk olan yok sayılır', () => {
  expect(restoreSell(JSON.stringify(filled()))?.brand).toBe('Bavaria');
  expect(restoreSell('{bozuk')).toBeNull();
  expect(restoreSell(JSON.stringify({ ...filled(), year: 2016 }))).toBeNull();
});
