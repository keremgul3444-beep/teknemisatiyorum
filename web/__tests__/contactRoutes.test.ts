// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST as message } from '../src/app/api/messages/route';
import { POST as reply } from '../src/app/api/messages/[id]/route';
import { GET as favState, POST as fav } from '../src/app/api/favorites/route';

afterEach(() => vi.restoreAllMocks());
const VALID = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') + '.y';
const req = (url: string, body?: unknown, o: { origin?: string | null; cookie?: string; method?: string } = {}) =>
  new Request(url, {
    method: o.method ?? 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { 'content-type': 'application/json', host: 'localhost:3001', ...(o.origin === null ? {} : { origin: o.origin ?? 'http://localhost:3001' }), ...(o.cookie ? { cookie: o.cookie } : {}) },
  });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

test('siteden mesaj: sohbet açılır, mesaj aynı anahtarla gider; satıcı bilgisi dönmez', async () => {
  const f = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json(201, { id: 'conv12345' }))
    .mockResolvedValueOnce(json(201, { id: 'm1' }));
  const r = await message(req('http://localhost:3001/api/messages', { listingId: 'clx1abcd2345', text: ' Merhaba ' }, { cookie: `tms_at=${VALID}` }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ conversationId: 'conv12345' });
  expect(String(f.mock.calls[0][0])).toMatch(/\/conversations$/);
  expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ subjectKind: 'listing', subjectId: 'clx1abcd2345' });
  expect(String(f.mock.calls[1][0])).toMatch(/\/conversations\/conv12345\/messages$/);
  expect(JSON.parse(String(f.mock.calls[1][1]!.body))).toEqual({ text: 'Merhaba' });
});

test('oturumsuz mesaj 401 (sayfa girişe yönlendirir); bozuk istek ve başka site reddedilir', async () => {
  const f = vi.spyOn(globalThis, 'fetch');
  expect((await message(req('http://localhost:3001/api/messages', { listingId: 'clx1abcd2345', text: 'x' }))).status).toBe(401);
  expect((await message(req('http://localhost:3001/api/messages', { listingId: '../x', text: 'x' }, { cookie: `tms_at=${VALID}` }))).status).toBe(400);
  expect((await message(req('http://localhost:3001/api/messages', { listingId: 'clx1abcd2345', text: 'x' }, { origin: 'https://kotu.site', cookie: `tms_at=${VALID}` }))).status).toBe(403);
  const ctx = { params: Promise.resolve({ id: 'conv12345' }) };
  expect((await reply(req('http://localhost:3001/api/messages/conv12345', { text: '' }, { cookie: `tms_at=${VALID}` }), ctx)).status).toBe(400);
  expect(f).not.toHaveBeenCalled();
});

test('favori durumu: oturum yoksa hata değil "giriş yok"; ekleme PUT, çıkarma DELETE', async () => {
  expect(await (await favState(req('http://localhost:3001/api/favorites?id=clx1abcd2345', undefined, { method: 'GET' }))).json()).toEqual({ favorited: false, loggedIn: false });
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { favorited: true }));
  expect(await (await favState(req('http://localhost:3001/api/favorites?id=clx1abcd2345', undefined, { method: 'GET', cookie: `tms_at=${VALID}` }))).json()).toEqual({ favorited: true, loggedIn: true });
  expect(String(f.mock.calls.at(-1)![0])).toMatch(/\/favorites\/clx1abcd2345$/);
  f.mockResolvedValue(new Response(null, { status: 204 }));
  await fav(req('http://localhost:3001/api/favorites', { id: 'clx1abcd2345', on: true }, { cookie: `tms_at=${VALID}` }));
  expect(f.mock.calls.at(-1)![1]!.method).toBe('PUT');
  await fav(req('http://localhost:3001/api/favorites', { id: 'clx1abcd2345', on: false }, { cookie: `tms_at=${VALID}` }));
  expect(f.mock.calls.at(-1)![1]!.method).toBe('DELETE');
});
