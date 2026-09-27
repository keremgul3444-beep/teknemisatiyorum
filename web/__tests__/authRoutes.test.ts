// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST as verify } from '../src/app/api/auth/verify/route';
import { POST as orders } from '../src/app/api/orders/route';
import { POST as otp } from '../src/app/api/auth/otp/route';

afterEach(() => vi.restoreAllMocks());
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
  const r = req('http://localhost:3001/api/orders', { listingId: 'l1', productCode: 'vitrin_7' }, 'http://localhost:3001', 'tms_at=TOKEN123');
  r.headers.set('x-forwarded-for', '9.9.9.9');
  const res = await call(orders, r);
  expect(await res.json()).toEqual({ orderId: 'o1', checkoutUrl: 'http://localhost:3001/odeme/deneme?order=o1' });
  const init = f.mock.calls[0][1] as RequestInit;
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN123');
  expect((init.headers as Record<string, string>)['X-Forwarded-For']).toBe('9.9.9.9');
});
