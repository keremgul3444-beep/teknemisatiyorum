// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { POST as save } from '../src/app/api/saved-searches/route';
import { DELETE as del, POST as seen } from '../src/app/api/saved-searches/[id]/route';
import { POST as readAll } from '../src/app/api/notifications/read-all/route';

afterEach(() => vi.restoreAllMocks());
const VALID = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') + '.y';
const req = (url: string, body?: unknown, method = 'POST', o: { cookie?: boolean; origin?: string } = { cookie: true }) => new Request(url, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  headers: { 'content-type': 'application/json', host: 'localhost:3001', origin: o.origin ?? 'http://localhost:3001', ...(o.cookie ? { cookie: `tms_at=${VALID}` } : {}) },
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test('aramayı kaydet: metin ve filtre API\'ye gider; oturumsuz 401 (sayfa girişe yönlendirir); bozuk gövde 400', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(201, { id: 'ss12345678' }));
  const r = await save(req('http://localhost:3001/api/saved-searches', { text: 'Yelkenli · Bodrum', filter: { equipment: [], type: 'yelkenli' } }));
  expect(await r.json()).toEqual({ id: 'ss12345678' });
  expect(String(f.mock.calls[0][0])).toMatch(/\/saved-searches$/);
  expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ text: 'Yelkenli · Bodrum', filter: { equipment: [], type: 'yelkenli' } });
  expect((await save(req('http://localhost:3001/api/saved-searches', { text: 'x', filter: { equipment: [] } }, 'POST', {}))).status).toBe(401);
  expect((await save(req('http://localhost:3001/api/saved-searches', { text: '', filter: null }))).status).toBe(400);
  expect(f).toHaveBeenCalledTimes(1);
});

test('kayıtlı arama sil (DELETE) ve görüldü (POST → /seen); başka siteden istek reddedilir', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
  expect((await del(req('http://localhost:3001/api/saved-searches/ss12345678', undefined, 'DELETE'), ctx('ss12345678'))).status).toBe(200);
  expect(f.mock.calls[0][1]!.method).toBe('DELETE');
  expect((await seen(req('http://localhost:3001/api/saved-searches/ss12345678'), ctx('ss12345678'))).status).toBe(200);
  expect(String(f.mock.calls[1][0])).toMatch(/\/saved-searches\/ss12345678\/seen$/);
  expect((await del(req('http://localhost:3001/api/saved-searches/x', undefined, 'DELETE', { cookie: true, origin: 'https://kotu.site' }), ctx('ss12345678'))).status).toBe(403);
  expect((await del(req('http://localhost:3001/api/saved-searches/x', undefined, 'DELETE'), ctx('../x'))).status).toBe(400);
});

test('bildirimlerin hepsini okundu yap', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect((await readAll(req('http://localhost:3001/api/notifications/read-all'))).status).toBe(200);
  expect(String(f.mock.calls[0][0])).toMatch(/\/notifications\/read-all$/);
});
