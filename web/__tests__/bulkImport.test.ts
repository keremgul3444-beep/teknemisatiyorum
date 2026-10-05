import { expect, test } from 'vitest';
import { decodeCsv } from '../src/lib/bulkImport';

test('CSV kodlaması: UTF-8 ve Türkçe Windows (1254) dosyaları doğru okunur', () => {
  expect(decodeCsv(new TextEncoder().encode('marka;açıklama\nŞimşek;Güzel'))).toBe('marka;açıklama\nŞimşek;Güzel');
  // "Şğı" Windows-1254: Ş=0xDE ğ=0xF0 ı=0xFD
  expect(decodeCsv(new Uint8Array([0xde, 0xf0, 0xfd]))).toBe('Şğı');
});
