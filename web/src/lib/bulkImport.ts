/** Toplu yükleme dosyasının en büyük boyutu (karakter); sunucu sınırının altında. */
export const MAX_CSV = 900_000;

/**
 * Dosya baytları → metin. Excel'in "CSV UTF-8" çıktısı UTF-8; eski "CSV (noktalı virgülle ayrılmış)" Türkçe Windows'ta
 * Windows-1254. Önce katı UTF-8 denenir, olmazsa Windows-1254.
 */
export function decodeCsv(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    return new TextDecoder('windows-1254').decode(u8);
  }
}
