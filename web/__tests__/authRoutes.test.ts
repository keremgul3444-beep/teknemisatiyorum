// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST as verify } from '../src/app/api/auth/verify/route';
import { POST as orders } from '../src/app/api/orders/route';
import { POST as otp } from '../src/app/api/auth/otp/route';
import { POST as logout } from '../src/app/api/auth/logout/route';

afterEach(() => vi.restoreAllMocks());
const VALID = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') + '.y';
/** Rota işleyicisini çağırır; yanıt her zaman döner (tip daraltması için). */
const call = async (h: (r: Request) => Promise<Response | undefined>, r: Request) => (await h(r))!;
const req = (url: string, body: unknown, origin: string | null = 'http://localhost:3001', cookie = '') =>
  new Request(url, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', host: 'localhost:3001', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) },
  });

test('giriş: anahtarlar yanıt gövdesinde değil HttpOnly çerezde', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ accessToken: 'A'.repeat(30), refreshToken: 'R'.repeat(40), user: { id: 'u', name: 'X' } }), { status: 200 }));
  const res = await call(verify, req('http://localhost:3001/api/auth/verify', { phone: '05321112233', code: '123456' }));
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).not.toContain('AAAA');
  expect(body).not.toContain('RRRR');
  const cookies = res.headers.getSetCookie().join('\n');
  expect(cookies).toMatch(/tms_at=A+;.*HttpOnly/i);
  expect(cookies).toMatch(/tms_rt=R+;.*HttpOnly/i);
  expect(cookies).toMatch(/SameSite=lax/i);
});

test('başka siteden gelen istek reddedilir (Origin); API çağrılmaz', async () => {
  const f = vi.spyOn(globalThis, 'fetch');
  expect((await call(verify, req('http://localhost:3001/api/auth/verify', { phone: '1', code: '1' }, 'https://kotu.site'))).status).toBe(403);
  expect((await call(orders, req('http://localhost:3001/api/orders', { listingId: 'l', productCode: 'vitrin_7' }, null, 'tms_at=x'))).status).toBe(403);
  expect((await call(otp, req('http://localhost:3001/api/auth/otp', { phone: '05321112233' }, 'https://kotu.site'))).status).toBe(403);
  expect(f).not.toHaveBeenCalled();
});

test('sunucu hatası aynı kod ve durumla iletilir; oturumsuz sipariş 401', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'OTP_INVALID', messageKey: 'errors.otp_invalid' }), { status: 400 }));
  const res = await call(verify, req('http://localhost:3001/api/auth/verify', { phone: '05321112233', code: '000000' }));
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ code: 'OTP_INVALID', messageKey: 'errors.otp_invalid' });
  expect((await call(orders, req('http://localhost:3001/api/orders', { listingId: 'l', productCode: 'vitrin_7' }))).status).toBe(401);
});

test('sipariş: ziyaretçi IP adresi ve anahtar API\'ye iletilir; ödeme adresi döner', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ orderId: 'o1', checkoutUrl: 'http://localhost:3001/odeme/deneme?order=o1' }), { status: 201 }));
  const r = req('http://localhost:3001/api/orders', { listingId: 'l1', productCode: 'vitrin_7' }, 'http://localhost:3001', 'tms_at=' + VALID);
  r.headers.set('x-forwarded-for', '9.9.9.9');
  const res = await call(orders, r);
  expect(await res.json()).toEqual({ orderId: 'o1', checkoutUrl: 'http://localhost:3001/odeme/deneme?order=o1' });
  const init = f.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ' + VALID);
  expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('9.9.9.9');
});

const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;

test('erişim anahtarı dolmuşsa satın alma sırasında sessizce yenilenir; yeni çerezler yazılır', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/refresh')) return new Response(JSON.stringify({ accessToken: jwt(Date.now() / 1000 + 900), refreshToken: 'N'.repeat(40) }), { status: 200 });
    return new Response(JSON.stringify({ orderId: 'o1', checkoutUrl: 'http://localhost:3001/odeme/deneme?order=o1' }), { status: 201 });
  });
  const res = await call(orders, req('http://localhost:3001/api/orders', { listingId: 'l1', productCode: 'vitrin_7' }, 'http://localhost:3001', `tms_at=${jwt(Date.now() / 1000 - 5)}; tms_rt=${'R'.repeat(40)}`));
  expect(res.status).toBe(200);
  expect(res.headers.getSetCookie().join(String.fromCharCode(10))).toMatch(/tms_rt=N+/);
  expect(f.mock.calls.map((c) => String(c[0]))).toEqual([expect.stringMatching(/\/auth\/refresh$/), expect.stringMatching(/\/orders$/)]);
});

test('boşta kalmış oturumda çıkış yine sunucudaki oturumu kapatır', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/refresh')) return new Response(JSON.stringify({ accessToken: jwt(Date.now() / 1000 + 900), refreshToken: 'N'.repeat(40) }), { status: 200 });
    return new Response(null, { status: 204 });
  });
  const res = await call(logout, req('http://localhost:3001/api/auth/logout', {}, 'http://localhost:3001', `tms_rt=${'R'.repeat(40)}`));
  expect(res.status).toBe(200);
  expect(f.mock.calls.some((c) => String(c[0]).endsWith('/auth/logout'))).toBe(true);
  expect(res.headers.getSetCookie().join(String.fromCharCode(10))).toMatch(/tms_rt=;/);
});

test('istemcinin uydurduğu IP, API tarafına iletilmez', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
  const r = req('http://localhost:3001/api/auth/otp', { phone: '05321112233' });
  r.headers.set('x-forwarded-for', '6.6.6.6, 9.9.9.9');
  await call(otp, r);
  expect(((f.mock.calls[0][1] as RequestInit).headers as Record<string, string>)['X-Forwarded-For']).toBe('9.9.9.9');
});
