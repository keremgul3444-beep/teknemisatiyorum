import { normalizeLocation } from '../src';

test('aynı yer farklı yazımda tek biçime iner', () => {
  for (const s of ['bodrum', 'BODRUM', '  Bodrum ', 'bOdRuM']) expect(normalizeLocation(s)).toBe('Bodrum');
  expect(normalizeLocation('istanbul')).toBe('İstanbul');
  expect(normalizeLocation('ÇEŞME')).toBe('Çeşme');
  expect(normalizeLocation('kaş')).toBe('Kaş');
});

test('listede olmayan yer Türkçe kurala göre baş harfi büyük yazılır; fazla boşluk atılır', () => {
  expect(normalizeLocation('göcek   iskele')).toBe('Göcek İskele');
  expect(normalizeLocation('IŞIKLAR')).toBe('Işıklar');
  expect(normalizeLocation('ayvalık')).toBe('Ayvalık');
});

test('tekrar uygulanınca değişmez', () => {
  for (const s of ['Bodrum', 'Göcek İskele', 'Işıklar']) expect(normalizeLocation(normalizeLocation(s))).toBe(s);
});

test('İngilizce klavyeyle büyük harf yazılan bilinen yer de tanınır (I → i)', () => {
  expect(normalizeLocation('FETHIYE')).toBe('Fethiye');
  expect(normalizeLocation('CESME')).toBe('Cesme'); // şapkasız yazım bilinen yere eşlenmez, yalnızca baş harf büyür
});
