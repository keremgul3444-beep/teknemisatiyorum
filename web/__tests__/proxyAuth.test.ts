// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

afterEach(() => vi.restoreAllMocks());
const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
const req = (path: string, cookie = '') => new NextRequest(`http://localhost:3001${path}`, { headers: { cookie, host: 'localhost:3001' } });

test('süresi dolmuş erişim anahtarı sessizce yenilenir; yeni çerezler yazılır', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accessToken: jwt(Date.now() / 1000 + 900), refreshToken: 'N'.repeat(40) }), { status: 200 }));
  const res = await proxy(req('/hesabim', `tms_at=${jwt(Date.now() / 1000 - 5)}; tms_rt=${'R'.repeat(40)}`));
  expect(res.headers.get('location')).toBeNull();
  expect(res.headers.getSetCookie().join('\n')).toMatch(/tms_rt=N+/);
});

test('yenileme reddedilirse girişe yönlendirilir ve çerezler silinir', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
  const res = await proxy(req('/en/hesabim/ilanlar', `tms_rt=${'R'.repeat(40)}`));
  expect(res.headers.get('location')).toBe('http://localhost:3001/en/giris?next=%2Fen%2Fhesabim%2Filanlar');
  expect(res.headers.getSetCookie().join('\n')).toMatch(/tms_rt=;/);
});

test('çerezsiz ziyaretçi girişe; geçerli anahtarlı ve herkese açık sayfalar etkilenmez', async () => {
  const f = vi.spyOn(globalThis, 'fetch');
  expect((await proxy(req('/odeme/deneme?order=o1'))).headers.get('location')).toBe('http://localhost:3001/giris?next=%2Fodeme%2Fdeneme%3Forder%3Do1');
  expect((await proxy(req('/hesabim', `tms_at=${jwt(Date.now() / 1000 + 600)}`))).headers.get('location')).toBeNull();
  expect((await proxy(req('/ilanlar'))).headers.get('location')).toBeNull();
  expect(f).not.toHaveBeenCalled();
});

test('girişli sayfada nonce\'lu sıkı politika, herkese açık sayfada nonce yok', async () => {
  const priv = await proxy(req('/giris'));
  expect(priv.headers.get('content-security-policy')).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  const pub = await proxy(req('/ilanlar'));
  expect(pub.headers.get('content-security-policy')).not.toContain('nonce-');
});
