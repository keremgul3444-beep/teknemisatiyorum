import { decodeCsvBytes } from '../src/csvText';

test('UTF-8 (BOM dahil) ve Windows-1254 Türkçe CSV doğru çözülür', () => {
  const utf = new TextEncoder().encode('﻿marka;konum\nBénéteau;Göcek İğneada ışık\n');
  expect(decodeCsvBytes(utf)).toBe('marka;konum\nBénéteau;Göcek İğneada ışık\n');
  // "Şile Ğ ı ş İ ğ" Windows-1254 baytlarıyla
  const cp = new Uint8Array([0xde, 0x69, 0x6c, 0x65, 0x20, 0xd0, 0x20, 0xfd, 0x20, 0xfe, 0x20, 0xdd, 0x20, 0xf0, 0x20, 0x80]);
  expect(decodeCsvBytes(cp)).toBe('Şile Ğ ı ş İ ğ €');
});
