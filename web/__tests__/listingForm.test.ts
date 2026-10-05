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

test('düzenleme: ilan forma dolar; yalnızca değişen alanlar gönderilir', async () => {
  const { fromListing, changedDraft } = await import('../src/lib/listingForm');
  const l = { brand: 'Bavaria', model: 'C41', year: 2016, lengthM: 12.4, cabins: 3, engine: 'Volvo', engineHours: 850, description: 'Temiz', price: 145000,
    type: 'yelkenli', currency: 'EUR' as const, location: 'Bodrum', flag: 'tr' as const, equipment: ['gps'], tradeIn: false, negotiable: true };
  const f = fromListing(l);
  expect(f).toMatchObject({ length: '12,4', year: '2016', engineHours: '850', price: '145000', flag: 'tr', negotiable: true });
  expect(changedDraft(f, f)).toEqual({});
  expect(changedDraft(f, { ...f, price: '139000' })).toEqual({ price: 139000 });
  expect(changedDraft(f, { ...f, description: 'Yeni boya', equipment: ['gps', 'radar'] as never })).toEqual({ description: 'Yeni boya', equipment: ['gps', 'radar'] });
  expect(fromListing({ ...l, engineHours: null, flag: null, cabins: 0 }, 'en')).toMatchObject({ length: '12.4', engineHours: '', flag: '', cabins: '' });
});

test('açıklama taslağı isteği: zorunlu bilgiler eksikse yok; yazılı açıklama not olarak gider', async () => {
  const { describeFacts, emptySell } = await import('../src/lib/listingForm');
  expect(describeFacts(emptySell())).toBeNull();
  const f = { ...emptySell(), brand: 'Bavaria', model: 'C41', year: '2016', length: '12,4', type: 'yelkenli' as const, description: 'tek sahibinden', equipment: ['gps'] as never };
  expect(describeFacts(f)).toEqual({ brand: 'Bavaria', model: 'C41', year: 2016, lengthM: 12.4, type: 'yelkenli', equipment: ['gps'], notes: 'tek sahibinden' });
});
