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

test('ziyaretçi IP adresi', () => {
  expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }))).toBe('9.9.9.9');
  expect(clientIp(new Request('http://x'))).toBe('');
});

test('girişten sonra yalnızca site içi adrese dönülür (açık yönlendirme yok)', () => {
  expect(safeNext('/hesabim/ilanlar', 'tr')).toBe('/hesabim/ilanlar');
  expect(safeNext('//kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext('https://kotu.site', 'en')).toBe('/en/hesabim');
  expect(safeNext('/\\kotu.site', 'tr')).toBe('/hesabim');
  expect(safeNext(undefined, 'tr')).toBe('/hesabim');
});
