import sharp from 'sharp';
import { dhash, hamming, informative, SAME_PHOTO_MAX_DISTANCE } from './phash';

// Gradyan ve şekilli iki farklı sahne üretir (dış dosyaya bağlı kalmasın).
const scene = (w: number, h: number, flip = false) => {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    const v = flip ? ((x * 7 + y * 3) % 255) : Math.round((x / w) * 200 + (y > h / 2 ? 40 : 0));
    raw[i] = v; raw[i + 1] = (v + 30) % 255; raw[i + 2] = 255 - v;
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } });
};

test('aynı fotoğrafın küçültülmüş ve yeniden sıkıştırılmış kopyası yakın; farklı fotoğraf uzak', async () => {
  const original = await scene(1200, 800).jpeg({ quality: 90 }).toBuffer();
  const copy = await sharp(original).resize(600).jpeg({ quality: 50 }).toBuffer();
  const other = await scene(1200, 800, true).jpeg({ quality: 90 }).toBuffer();
  const [a, b, c] = await Promise.all([dhash(original), dhash(copy), dhash(other)]);
  expect(a).toMatch(/^[0-9a-f]{16}$/);
  expect(hamming(a, b)).toBeLessThanOrEqual(SAME_PHOTO_MAX_DISTANCE);
  expect(hamming(a, c)).toBeGreaterThan(SAME_PHOTO_MAX_DISTANCE);
  expect(hamming(a, a)).toBe(0);
});

test('düz renkli görselin izi karşılaştırmaya girmez', async () => {
  const flat = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 15, g: 110, b: 104 } } }).jpeg().toBuffer();
  expect(informative(await dhash(flat))).toBe(false);
  expect(informative(await dhash(await scene(400, 300).jpeg().toBuffer()))).toBe(true);
});
