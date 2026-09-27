// @vitest-environment node
import { expect, test } from 'vitest';
import { clientIp, cookieOptions, jwtExpired, safeNext } from '../src/lib/session';

const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ sub: 'u', exp })).toString('base64url')}.y`;

test('süre kontrolü (30 sn pay) ve bozuk anahtar', () => {
  const now = 1_800_000_000_000;
  expect(jwtExpired(jwt(now / 1000 + 600), now)).toBe(false);
  expect(jwtExpired(jwt(now / 1000 + 10), now)).toBe(true);
  expect(jwtExpired('bozuk', now)).toBe(true);
});

test('çerez bayrakları', () => {
  expect(cookieOptions(900, true)).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 900 });
  expect(cookieOptions(900, false).secure).toBe(false);
});

test('ziyaretçi IP adresi: istemcinin yazdığı değil, önümüzdeki güvenilir ara katmanın eklediği halka', () => {
  // Saldırgan "6.6.6.6" uydurdu; yük dengeleyici gerçek adresi (9.9.9.9) sona ekledi (1 güvenilir halka).
  expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 9.9.9.9' } }), 1)).toBe('9.9.9.9');
  expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '6.6.6.6, 9.9.9.9, 10.0.0.2' } }), 2)).toBe('9.9.9.9');
  expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9' } }), 3)).toBe('9.9.9.9');
  expect(clientIp(new Request('http://x'))).toBe('');
});

test('girişten sonra yalnızca site içi adrese dönülür (açık yönlendirme yok)', () => {
  expect(safeNext('/hesabim/ilanlar', 'tr')).toBe('/hesabim/ilanlar');
  expect(safeNext('//kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext('https://kotu.site', 'en')).toBe('/en/hesabim');
  expect(safeNext('/\\kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext(undefined, 'tr')).toBe('/hesabim');
  // Sekme/satır sonu tarayıcıda silinir ve "//kotu.site" kalır: reddedilmeli.
  expect(safeNext('/\t/kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext('/\n/kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext('/odeme/sonuc?order=abc', 'tr')).toBe('/odeme/sonuc?order=abc');
});
