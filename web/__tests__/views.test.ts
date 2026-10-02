// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST as views } from '../src/app/api/views/route';

afterEach(() => vi.restoreAllMocks());
const VALID = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') + '.y';
const req = (body: unknown, origin: string | null = 'http://localhost:3001', cookie = '') =>
  new Request('http://localhost:3001/api/views', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', host: 'localhost:3001', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}) },
  });

test('ziyaret ilanın sayma ucuna iletilir; oturum varsa satıcının kendi ziyareti ayıklansın diye anahtar da gider', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  expect((await views(req({ id: 'clx1abcd2345' }, 'http://localhost:3001', `tms_at=${VALID}`))).status).toBe(204);
  const [url, init] = f.mock.calls[0];
  expect(String(url)).toMatch(/\/listings\/clx1abcd2345\/view$/);
  expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${VALID}`);
});

test('başka siteden istek reddedilir; geçersiz kimlik ve API hatası sayfayı etkilemez', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
  expect((await views(req({ id: 'clx1abcd2345' }, 'https://kotu.site'))).status).toBe(403);
  expect((await views(req({ id: '../admin' }))).status).toBe(204);
  expect(f).not.toHaveBeenCalled();
  expect((await views(req({ id: 'clx1abcd2345' }))).status).toBe(204);
});
