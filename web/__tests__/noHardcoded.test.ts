// Uygulamadaki kuralın aynısı: bileşenlerde Türkçe metin JSX'e gömülmez, çeviri dosyasından gelir.
import fs from 'fs';
import path from 'path';
import { expect, test } from 'vitest';

const files = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : []));

test('JSX içinde Türkçe karakterli sabit metin yok', () => {
  const bad = files(path.join(__dirname, '../src')).filter((f) => />[^<{}]*[çğıöşüÇĞİÖŞÜ][^<{}]*</.test(fs.readFileSync(f, 'utf8')));
  expect(bad).toEqual([]);
});
