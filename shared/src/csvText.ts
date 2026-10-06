/**
 * CSV dosyasının baytlarını metne çevirir: geçerli UTF-8 ise öyle, değilse Excel'in eski Türkçe kaydı (Windows-1254).
 * Telefonda TextDecoder yalnızca UTF-8 bildiği için çözüm elle yapılır (site ve uygulama aynı kuralı kullanır).
 */
const CP1254_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9f: 0x0178,
  0xd0: 0x011e, 0xdd: 0x0130, 0xde: 0x015e, 0xf0: 0x011f, 0xfd: 0x0131, 0xfe: 0x015f,
};

function isUtf8(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; ) {
    const c = b[i];
    const n = c < 0x80 ? 0 : (c & 0xe0) === 0xc0 && c >= 0xc2 ? 1 : (c & 0xf0) === 0xe0 ? 2 : (c & 0xf8) === 0xf0 && c <= 0xf4 ? 3 : -1;
    if (n < 0 || i + n >= b.length + (n ? 0 : 1)) return false;
    for (let k = 1; k <= n; k++) if ((b[i + k] & 0xc0) !== 0x80) return false;
    i += n + 1;
  }
  return true;
}

function utf8(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i];
    let cp: number;
    if (c < 0x80) { cp = c; i += 1; }
    else if (c < 0xe0) { cp = ((c & 0x1f) << 6) | (b[i + 1] & 0x3f); i += 2; }
    else if (c < 0xf0) { cp = ((c & 0x0f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f); i += 3; }
    else { cp = ((c & 0x07) << 18) | ((b[i + 1] & 0x3f) << 12) | ((b[i + 2] & 0x3f) << 6) | (b[i + 3] & 0x3f); i += 4; }
    s += String.fromCodePoint(cp);
  }
  return s;
}

export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const text = isUtf8(b) ? utf8(b) : Array.from(b, (c) => String.fromCharCode(CP1254_HIGH[c] ?? c)).join('');
  return text.replace(/^﻿/, '');
}
