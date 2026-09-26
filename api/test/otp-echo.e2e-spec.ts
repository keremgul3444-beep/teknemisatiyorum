import { createTestApp, type TestApp } from './setup';
import { resetEnvCache } from '../src/config/env';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); delete process.env.DEV_OTP_ECHO; resetEnvCache(); });

const setEnv = (echo: string | undefined, nodeEnv: string) => {
  if (echo === undefined) delete process.env.DEV_OTP_ECHO; else process.env.DEV_OTP_ECHO = echo;
  process.env.NODE_ENV = nodeEnv;
  resetEnvCache();
};

test('varsayılan: kod yanıtta dönmez', async () => {
  setEnv(undefined, 'test');
  const r = await t.http().post('/auth/otp').send({ phone: '05441110001' });
  expect(r.status).toBe(204);
  expect(r.body).toEqual({});
});

test('kapalı beta ayarı açıksa kod yanıtta döner', async () => {
  setEnv('1', 'development');
  const r = await t.http().post('/auth/otp').send({ phone: '05441110002' });
  expect(r.status).toBe(200);
  expect(r.body.devCode).toMatch(/^\d{6}$/);
  const v = await t.http().post('/auth/verify').send({ phone: '05441110002', code: r.body.devCode, deviceName: 'x' });
  expect(v.status).toBe(200);
});

test('üretimde ayar açık olsa bile kod dönmez', async () => {
  setEnv('1', 'production');
  const r = await t.http().post('/auth/otp').send({ phone: '05441110003' });
  expect(r.status).toBe(204);
  setEnv(undefined, 'test');
});
