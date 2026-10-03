import { createTestApp, type TestApp } from './setup';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

test('sağlık uç noktası', async () => {
  const r = await t.http().get('/health');
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
});

test('hazır olma: veritabanı yanıt veriyorsa 200, ulaşılamıyorsa 503 (kesinti takibi gerçek durumu görür)', async () => {
  expect((await t.http().get('/health/ready')).body).toEqual({ ok: true });
  const spy = jest.spyOn(t.prisma, '$queryRaw').mockRejectedValueOnce(new Error('bağlantı yok'));
  const r = await t.http().get('/health/ready');
  expect(r.status).toBe(503);
  spy.mockRestore();
});
