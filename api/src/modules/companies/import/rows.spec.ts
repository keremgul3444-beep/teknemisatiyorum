import { parseCsv } from './csv';
import { mapHeader, number, toImportRow, TEMPLATE_CSV } from './rows';

test('CSV: ; ayraç, tırnaklı alan, satır içi satır sonu, çift tırnak, BOM, boş satır', () => {
  expect(parseCsv('﻿a;b\r\n"x;1";"çok\nsatırlı ""tırnak"""\r\n\r\n3;4')).toEqual([['a', 'b'], ['x;1', 'çok\nsatırlı "tırnak"'], ['3', '4']]);
  expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
});

test('sayılar: ondalık virgül, binlik nokta/virgül/boşluk, para işareti', () => {
  expect(number('12,4')).toBe(12.4);
  expect(number('145.000')).toBe(145000);
  expect(number('1.250.000,50')).toBe(1250000.5);
  expect(number('145,000')).toBe(145000);
  expect(number('€ 95 000')).toBe(95000);
  expect(number('abc')).toBeNull();
});

test('şablon satırı eksiksiz bir ilan taslağına çevrilir', () => {
  const [header, row] = parseCsv(TEMPLATE_CSV);
  const { index, missing } = mapHeader(header);
  expect(missing).toEqual([]);
  const r = toImportRow(row, index, 2);
  expect(r).toEqual({ ok: { row: 2, photos: ['https://ornek.com/foto1.jpg', 'https://ornek.com/foto2.jpg'], draft: {
    brand: 'Bavaria', model: 'Cruiser 41', location: 'Bodrum', year: 2016, lengthM: 12.4, price: 145000, type: 'yelkenli', currency: 'EUR',
    cabins: 3, engine: 'Volvo Penta D2-40', engineHours: 850, flag: 'tr', tradeIn: false, negotiable: true, equipment: ['jenerator', 'otopilot'],
    description: 'Tek sahibinden, bakımlı.', videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
  } } });
});

test('İngilizce başlıklar; anlaşılır satır hataları; eksik zorunlu sütun', () => {
  const { index, missing } = mapHeader(['Brand', 'Model', 'Year', 'Length', 'Type', 'Price', 'Currency', 'City', 'Photos', 'Equipment']);
  expect(missing).toEqual([]);
  const bad = toImportRow(['Beneteau', '', '20x', '11', 'denizaltı', '-5', 'eur', 'Göcek', 'http://insecure.com/a.jpg', 'uçan halı'], index, 7);
  expect('errors' in bad && bad.errors.map((e) => `${e.field}:${e.code}`)).toEqual(['model:required', 'year:invalid', 'price:invalid', 'type:invalid', 'equipment:invalid', 'photos:invalid']);
  expect(mapHeader(['marka', 'model']).missing).toEqual(['year', 'lengthM', 'type', 'price', 'location', 'photos']);
});
