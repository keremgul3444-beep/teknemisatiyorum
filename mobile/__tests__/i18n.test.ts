import tr from '@/i18n/tr.json';
import en from '@/i18n/en.json';

const keys = (o: any, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const flat = (o: any): string[] => Object.values(o).flatMap((v: any) => (typeof v === 'object' ? flat(v) : [v]));

test('tr ve en anahtarları birebir aynı', () => {
  expect(keys(en).sort()).toEqual(keys(tr).sort());
});

test('boş çeviri yok', () => {
  expect(flat(tr).every((s) => s.trim().length > 0)).toBe(true);
  expect(flat(en).every((s) => s.trim().length > 0)).toBe(true);
});
