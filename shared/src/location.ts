import { LOCATIONS } from './assistant/parse';

const lower = (s: string) => s.toLocaleLowerCase('tr-TR');
// Eşleme anahtarında ı → i: İngilizce klavyedeki "FETHIYE" de Fethiye'ye eşlensin.
const key = (s: string) => lower(s).replace(/ı/g, 'i');
const KNOWN = new Map(LOCATIONS.map((l) => [key(l), l]));

/**
 * Konum adının tek biçimi: "bodrum", " BODRUM " ve "Bodrum" aynı yer sayılsın (arama, hazır arama
 * sayfaları ve site haritası sayıları bölünmesin). Bilinen yerler listedeki yazımla, diğerleri Türkçe
 * kurala göre her kelimenin baş harfi büyük yazılır (i → İ, ı → I).
 */
export function normalizeLocation(s: string): string {
  const words = lower(s).trim().split(/\s+/).filter(Boolean);
  return KNOWN.get(key(words.join(' '))) ?? words.map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1)).join(' ');
}
