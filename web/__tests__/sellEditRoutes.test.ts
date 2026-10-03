// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { PATCH as edit } from '../src/app/api/sell/[id]/route';
import { POST as doc } from '../src/app/api/sell/[id]/document/route';
import { POST as upload } from '../src/app/api/sell/document/route';

afterEach(() => vi.restoreAllMocks());
const VALID = 'x.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') + '.y';
const headers = (o: { origin?: string } = {}) => ({ host: 'localhost:3001', origin: o.origin ?? 'http://localhost:3001', cookie: `tms_at=${VALID}` });
const req = (url: string, body: unknown, method = 'POST', o: { origin?: string } = {}) =>
  new Request(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers(o) } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test('ilan düzenleme PATCH ile yalnızca gönderilen alanlarla iletilir; başka site ve bozuk kimlik reddedilir', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(200, { id: 'clx1abcd2345', status: 'pending', price: 1 }));
  const r = await edit(req('http://localhost:3001/api/sell/clx1abcd2345', { price: 139000 }, 'PATCH'), ctx('clx1abcd2345'));
  expect(await r.json()).toEqual({ id: 'clx1abcd2345', status: 'pending' });
  expect(String(f.mock.calls[0][0])).toMatch(/\/listings\/clx1abcd2345$/);
  expect(f.mock.calls[0][1]!.method).toBe('PATCH');
  expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ price: 139000 });
  expect((await edit(req('http://localhost:3001/api/sell/x', { price: 1 }, 'PATCH', { origin: 'https://kotu.site' }), ctx('clx1abcd2345'))).status).toBe(403);
  expect((await edit(req('http://localhost:3001/api/sell/x', { price: 1 }, 'PATCH'), ctx('../admin'))).status).toBe(400);
  expect(f).toHaveBeenCalledTimes(1);
});

test('ruhsat başvurusu: tür ruhsat, ilan kimliği ve seri no son haneleri; en çok iki dosya', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(201, { id: 'vr1', status: 'pending', kind: 'ruhsat' }));
  const r = await doc(req('http://localhost:3001/api/sell/clx1abcd2345/document', { fileIds: ['a1b2c3d4-0000', 'e5f6a7b8-1111'], engineSerialLast4: ' 4F2A ' }), ctx('clx1abcd2345'));
  expect(r.status).toBe(200);
  expect(String(f.mock.calls[0][0])).toMatch(/\/verification\/requests$/);
  expect(JSON.parse(String(f.mock.calls[0][1]!.body))).toEqual({ kind: 'ruhsat', listingId: 'clx1abcd2345', fileIds: ['a1b2c3d4-0000', 'e5f6a7b8-1111'], details: { engineSerialLast4: '4F2A' } });
  expect((await doc(req('http://localhost:3001/api/sell/clx1abcd2345/document', { fileIds: ['a1b2c3d4-0000', 'b', 'c'] }), ctx('clx1abcd2345'))).status).toBe(400);
  expect(f).toHaveBeenCalledTimes(1);
});

test('belge yükleme korumalı görünürlükle gider; PDF kabul, başka tür reddedilir', async () => {
  const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(201, { id: 'file12345678' }));
  const form = new FormData();
  form.set('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'ruhsat.pdf');
  const r = await upload(new Request('http://localhost:3001/api/sell/document', { method: 'POST', body: form, headers: headers() }));
  expect(await r.json()).toEqual({ id: 'file12345678' });
  const sent = f.mock.calls[0][1]!.body as FormData;
  expect(sent.get('visibility')).toBe('private');
  const bad = new FormData();
  bad.set('file', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
  expect((await upload(new Request('http://localhost:3001/api/sell/document', { method: 'POST', body: bad, headers: headers() }))).status).toBe(400);
});
