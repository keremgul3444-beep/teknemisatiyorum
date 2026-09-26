import { createTestApp, type TestApp } from './setup';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

test('sağlık uç noktası', async () => {
  const r = await t.http().get('/health');
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
});
