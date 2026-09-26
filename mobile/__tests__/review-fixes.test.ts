import fs from 'fs';
import path from 'path';
import { parseQuery, LOCATIONS } from '@tms/shared';
import { queryToText } from '@tms/shared';
import { useStore } from '@/services/store';

// Bulgu 1: filtre ekranındaki sorgu, kaydedilip tekrar açıldığında aynı filtreye dönmeli.
test.each([
  { equipment: ['jenerator', 'branda'], maxLength: 12, minYear: 2015 },
  { equipment: [], type: 'yelkenli', location: 'Bodrum', maxPrice: 200000, currency: 'EUR' },
  { equipment: ['klima'], minLength: 10, maxLength: 14, maxYear: 2012, type: 'motoryat' },
] as any[])('queryToText → parseQuery gidiş-dönüş: %j', (q) => {
  expect(parseQuery(queryToText(q))).toEqual(q);
});

// Bulgu 3: işlem kayıtları dile bağlı metin değil, çeviri anahtarı taşımalı.
test('yönetim işlem kaydı çeviri anahtarıyla yazılır', () => {
  const s = useStore.getState();
  s.resetDemo();
  const id = s.createListing({ brand: 'X', model: 'Y', year: 2016, lengthM: 10, price: 1, currency: 'EUR', type: 'yelkenli', location: 'Bodrum', equipment: [], cabins: 1, engine: 'e', description: 'd' });
  const item = useStore.getState().adminItems.find((a) => a.refId === id)!;
  useStore.getState().setAdminStatus(item.id, 'onaylandi');
  expect(useStore.getState().audit[0]).toMatchObject({ key: 'audit.listingApproved', params: { title: 'X Y' } });
});

// Bulgu 3: ekran ve bileşen kodunda i18n dışı Türkçe metin kalmamalı (sahte veri hariç).
test('UI kodunda sabit Türkçe metin yok', () => {
  const roots = ['src/app', 'src/components'].map((d) => path.join(__dirname, '..', d));
  const files: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.tsx') && files.push(path.join(d, e.name)));
  roots.forEach(walk);
  const offenders: string[] = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      const strings = line.match(/(['"`])(?:(?!\1).)*[çğıöşüÇĞİÖŞÜ](?:(?!\1).)*\1/g) ?? [];
      // Dil seçici kendi adını gösterir ("Türkçe"); tr-TR yerel ayar kodu metin değildir.
      // Yer adları (özel isim) veridir, çevrilmez.
      strings.filter((s) => !/Türkçe|tr-TR/.test(s) && !LOCATIONS.includes(s.slice(1, -1))).forEach((s) => offenders.push(`${path.relative(process.cwd(), f)}:${i + 1} ${s}`));
    });
  }
  expect(offenders).toEqual([]);
});

test('geri düğmesi etiketi çeviriden gelir', () => {
  const header = fs.readFileSync(path.join(__dirname, '..', 'src/components/Header.tsx'), 'utf8');
  expect(header).not.toMatch(/accessibilityLabel="back"/);
});
