import { parseQuery, isEmptyQuery } from '@/features/assistant/parse';
import { matchListings } from '@/features/assistant/match';
import { useStore } from '@/services/store';

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
  const listings = () => {
    useStore.getState().resetDemo();
    return useStore.getState().listings;
  };
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
