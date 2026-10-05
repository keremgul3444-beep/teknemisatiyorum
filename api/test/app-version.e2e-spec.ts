import { createTestApp, type TestApp } from './setup';
import { resetEnvCache } from '../src/config/env';

let t: TestApp;
beforeAll(async () => {
  Object.assign(process.env, { MIN_APP_VERSION: '1.4.0', APP_STORE_URL_ANDROID: 'https://play.google.com/store/apps/details?id=x' });
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
  for (const k of ['MIN_APP_VERSION', 'APP_STORE_URL_ANDROID']) delete process.env[k];
  resetEnvCache();
});

test('eski uygulama sürümü 426 ve mağaza bağlantısı alır; güncel sürüm, başlıksız istek (site) ve sağlık kontrolü etkilenmez', async () => {
  const old = await t.http().get('/listings').set('X-App-Version', '1.3.9');
  expect(old.status).toBe(426);
  expect(old.body).toMatchObject({ code: 'UPGRADE_REQUIRED', params: { min: '1.4.0', android: 'https://play.google.com/store/apps/details?id=x' } });
  expect((await t.http().get('/listings').set('X-App-Version', '1.4.0')).status).toBe(200);
  expect((await t.http().get('/listings')).status).toBe(200);
  expect((await t.http().get('/health').set('X-App-Version', '1.0.0')).status).toBe(200);
});
