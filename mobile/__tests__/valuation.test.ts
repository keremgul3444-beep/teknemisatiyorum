import { estimateValue } from '@/features/valuation';
import { useStore } from '@/services/store';

test('benzer ilanlardan aralık üretir', () => {
  useStore.getState().resetDemo();
  const r = estimateValue({ type: 'yelkenli', year: 2017, lengthM: 12 }, useStore.getState().listings);
  expect(r.comparables.length).toBeGreaterThanOrEqual(3);
  expect(r.lowEUR).toBeLessThan(r.highEUR);
  expect(r.comparables.every((l) => l.type === 'yelkenli')).toBe(true);
});

test('benzer yoksa boş döner', () => {
  const r = estimateValue({ type: 'gulet', year: 2024, lengthM: 50 }, []);
  expect(r).toEqual({ lowEUR: 0, highEUR: 0, comparables: [] });
});

test('daha yeni tekne daha yüksek değer alır', () => {
  useStore.getState().resetDemo();
  const ls = useStore.getState().listings;
  const old = estimateValue({ type: 'yelkenli', year: 2014, lengthM: 12 }, ls);
  const neu = estimateValue({ type: 'yelkenli', year: 2020, lengthM: 12 }, ls);
  expect(neu.lowEUR).toBeGreaterThan(old.lowEUR);
});
