import sharp from 'sharp';

/**
 * Algısal iz (dHash, 64 bit): görsel 9×8 gri tona küçültülür, her satırda yan yana piksellerin parlaklık farkı bit olur.
 * Yeniden sıkıştırma, boyut değişikliği ve hafif renk oynamasında iz neredeyse aynı kalır; farklı fotoğraflarda belirgin ayrışır.
 */
export async function dhash(buf: Buffer): Promise<string> {
  const px = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits = (bits << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, '0');
}

/** İki iz arasındaki farklı bit sayısı (0 = aynı görsel). */
export function hamming(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

/** Düz renk ya da neredeyse düz görselin izi (hep 0 ya da hep 1) her düz görsele benzer: karşılaştırmada kullanılmaz. */
export function informative(h: string): boolean {
  const ones = hamming(h, '0000000000000000');
  return ones >= 4 && ones <= 60;
}

/** Bu kadar ya da daha az farklı bit: büyük olasılıkla aynı fotoğraf. */
export const SAME_PHOTO_MAX_DISTANCE = 6;
