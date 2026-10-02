import { parseQuery, isEmptyQuery } from '../src/assistant/parse';
import { failures, matchListings } from '../src/assistant/match';
import { queryToText } from '../src/assistant/chips';
import { makeListings } from '../src/seed/listings';

describe('parseQuery', () => {
  test('kullanıcının örneği', () => {
    expect(parseQuery('12 metreye kadar jeneratörlü brandalı 2015 sonrası')).toEqual(
      { maxLength: 12, minYear: 2015, equipment: ['jenerator', 'branda'] });
  });
  test('tam boy ±1 m aralık, milyon euro bütçe', () => {
    expect(parseQuery('24 metre 2015 sonrası 5 milyon euroya kadar tekne')).toEqual(
      { minLength: 23, maxLength: 25, minYear: 2015, maxPrice: 5000000, currency: 'EUR', equipment: [] });
  });
  test('sembollü fiyat, altı ifadesi, tip', () => {
    expect(parseQuery('€300.000 altı motoryat')).toEqual(
      { maxPrice: 300000, currency: 'EUR', type: 'motoryat', equipment: [] });
  });
  test('üstü ifadesi ve konum', () => {
    expect(parseQuery("15 metre üstü katamaran Göcek'te")).toEqual(
      { minLength: 15, type: 'katamaran', location: 'Göcek', equipment: [] });
  });
  test('fiyat yıl sanılmaz', () => {
    expect(parseQuery('2000 euro').minYear).toBeUndefined();
    expect(parseQuery('2000 euro').maxPrice).toBe(2000);
  });
  test('civarı ±%15', () => {
    expect(parseQuery('1,5 milyon tl civarı')).toEqual(
      { minPrice: 1275000, maxPrice: 1725000, currency: 'TRY', equipment: [] });
  });
  test('İngilizce', () => {
    expect(parseQuery('sailboat up to 10 m after 2010 with generator')).toEqual(
      { maxLength: 10, minYear: 2010, type: 'yelkenli', equipment: ['jenerator'] });
  });
  test('öncesi', () => {
    expect(parseQuery('2010 öncesi gulet')).toEqual({ maxYear: 2010, type: 'gulet', equipment: [] });
  });
  test('boş ve anlamsız', () => {
    expect(isEmptyQuery(parseQuery(''))).toBe(true);
    expect(isEmptyQuery(parseQuery('asdf qwe'))).toBe(true);
  });
});

describe('matchListings', () => {
  const listings = () => makeListings();
  test('kullanıcının örneği gerçek ilanlarla eşleşir', () => {
    const r = matchListings(listings(), parseQuery('12 metreye kadar jeneratörlü brandalı 2015 sonrası'));
    expect(r.exact.map((l) => l.id).sort()).toEqual(['l15', 'l22', 'l7'].sort());
    r.exact.forEach((l) => {
      expect(l.lengthM).toBeLessThanOrEqual(12);
      expect(l.year).toBeGreaterThanOrEqual(2015);
    });
  });
  test('yakın sonuç tek eksik kriteri söyler', () => {
    const r = matchListings(listings(), parseQuery('12 metreye kadar jeneratörlü brandalı 2015 sonrası'));
    expect(r.near.length).toBeGreaterThan(0);
    r.near.forEach((n) => expect(n.missing).toHaveLength(1));
  });
  test('farklı para birimleri TRY üzerinden karşılaştırılır', () => {
    const r = matchListings(listings(), parseQuery('2 milyon tl altı'));
    expect(r.exact.map((l) => l.id).sort()).toEqual(['l10', 'l11', 'l14', 'l19'].sort());
  });
  test('onay bekleyen ilan sonuçta çıkmaz', () => {
    const ls = listings().map((l) => (l.id === 'l6' ? { ...l, status: 'onay-bekliyor' as const } : l));
    expect(matchListings(ls, parseQuery('katamaran')).exact.map((l) => l.id)).not.toContain('l6');
  });
  test('boş sorgu tüm yayındaki ilanları verir', () => {
    const r = matchListings(listings(), parseQuery(''));
    expect(r.exact).toHaveLength(25);
    expect(r.near).toEqual([]);
  });
});

import { detectCategory } from '../src/assistant/serviceCategory';

describe('detectCategory', () => {
  test('motor derdi motor kategorisine gider', () => { expect(detectCategory('motorum su alıyor')).toBe('motor'); });
  test('akü sorunu elektrik', () => { expect(detectCategory('akü şarj etmiyor')).toBe('elektrik'); });
  test('İngilizce', () => { expect(detectCategory('need new sails')).toBe('yelken'); });
  test('tanınmayan metin', () => { expect(detectCategory('merhaba')).toBeUndefined(); });
});

describe('aralıklar', () => {
  test('boy aralığı', () => { expect(parseQuery('10-14 metre motoryat')).toEqual({ minLength: 10, maxLength: 14, type: 'motoryat', equipment: [] }); });
  test('yıl aralığı', () => { expect(parseQuery('2010–2015 yelkenli')).toEqual({ minYear: 2010, maxYear: 2015, type: 'yelkenli', equipment: [] }); });
});

describe('para birimsiz fiyat', () => {
  test('"300 bine kadar" TL sayılır', () => {
    expect(parseQuery('300 bine kadar sürat teknesi')).toEqual({ maxPrice: 300000, currency: 'TRY', type: 'surat', equipment: [] });
  });
  test('"2 milyona kadar"', () => {
    expect(parseQuery('2 milyona kadar yelkenli')).toEqual({ maxPrice: 2000000, currency: 'TRY', type: 'yelkenli', equipment: [] });
  });
  test('çıplak sayı fiyat sayılmaz', () => {
    expect(parseQuery('12 metre').maxPrice).toBeUndefined();
  });
});

describe('motor saati, bayrak, takas, pazarlık', () => {
  test('ayrıştırılır; "2000 saat" yıl sanılmaz', () => {
    expect(parseQuery('2015 sonrası 1000 saat altı yelkenli')).toMatchObject({ minYear: 2015, maxEngineHours: 1000, type: 'yelkenli' });
    expect(parseQuery('motor saati 1.500e kadar türk bayraklı')).toMatchObject({ maxEngineHours: 1500, flag: 'tr' });
    expect(parseQuery('2000 saatten az motoryat')).toMatchObject({ maxEngineHours: 2000, type: 'motoryat' });
    expect(parseQuery('2000 saatten az motoryat').minYear).toBeUndefined();
    expect(parseQuery('yabancı bayraklı takaslı pazarlıklı gulet')).toMatchObject({ flag: 'foreign', tradeIn: true, negotiable: true, type: 'gulet' });
    expect(parseQuery('under 800 hours catamaran')).toMatchObject({ maxEngineHours: 800, type: 'katamaran' });
  });

  test('eşleştirme: motor saati yazılmamış ilan motor saati kriterini karşılamaz; tek eksik "yakın" sonuçta görünür', () => {
    const base = { lengthM: 12, year: 2018, price: 100000, currency: 'EUR' as const, type: 'yelkenli' as const, location: 'Bodrum', equipment: [], status: 'yayinda' };
    const q = { equipment: [], maxEngineHours: 1000, tradeIn: true as const };
    expect(failures({ ...base, engineHours: 800, tradeIn: true }, q)).toEqual([]);
    expect(failures({ ...base, engineHours: null, tradeIn: true }, q)).toEqual(['engineHours']);
    expect(failures({ ...base, engineHours: 1200, tradeIn: false }, q)).toEqual(['engineHours', 'tradeIn']);
    expect(failures({ ...base, flag: 'foreign' }, { equipment: [], flag: 'tr' })).toEqual(['flag']);
  });

  test('kayıtlı arama metni geri okunabilir', () => {
    const q = { equipment: [], maxEngineHours: 1500, flag: 'tr' as const, tradeIn: true as const, negotiable: true as const, type: 'motoryat' as const };
    expect(parseQuery(queryToText(q))).toMatchObject(q);
  });
});
