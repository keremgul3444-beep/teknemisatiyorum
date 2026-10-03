import { resetEnvCache } from '../config/env';
import { DevStoreVerifier, DevWebPayment, paymentProviders, signPayload } from './payments';

const base = {
  NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40),
  ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 's'.repeat(40), WEB_URL: 'http://localhost:3001',
};
const saved = { ...process.env };
const withEnv = (e: Record<string, string>) => { Object.assign(process.env, base, e); resetEnvCache(); };
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

test('deneme ödemesi imzalı bildirim üretir ve doğrular', async () => {
  withEnv({ PAYMENTS_MODE: 'dev' });
  const p = new DevWebPayment();
  const { providerRef, checkoutUrl } = await p.createCheckout({ orderId: 'o1', amountKurus: 100 });
  expect(providerRef).toMatch(/^dev_/);
  expect(checkoutUrl).toBe('http://localhost:3001/odeme/deneme?order=o1');
  const { rawBody, signature } = p.simulate({ providerRef, orderId: 'o1', result: 'success', amountKurus: 100 });
  expect(p.verifyCallback(rawBody, signature)).toEqual({ providerRef, orderId: 'o1', result: 'success', amountKurus: 100 });
});

test('imzasız ya da değiştirilmiş bildirim reddedilir', () => {
  withEnv({ PAYMENTS_MODE: 'dev' });
  const p = new DevWebPayment();
  const raw = JSON.stringify({ providerRef: 'dev_1', orderId: 'o1', result: 'success', amountKurus: 100 });
  expect(() => p.verifyCallback(raw, undefined)).toThrow();
  expect(() => p.verifyCallback(raw.replace('100', '1'), signPayload(raw))).toThrow();
  expect(() => p.verifyCallback('bozuk-json', signPayload('bozuk-json'))).toThrow();
});

test('deneme makbuzu biçimi', async () => {
  withEnv({ PAYMENTS_MODE: 'dev' });
  const v = new DevStoreVerifier();
  await expect(v.verify('ios', 'dev:tms.vitrin_7:abc123')).resolves.toEqual({ storeProductId: 'tms.vitrin_7', transactionId: 'dev:tms.vitrin_7:abc123' });
  await expect(v.verify('ios', 'gercek-makbuz')).rejects.toThrow();
});

test('üretimde deneme ödemesi başlamaz; live bu turda bağlanmadı', () => {
  withEnv({ NODE_ENV: 'production', PUBLIC_URL: 'https://api.test', PAYMENTS_MODE: 'dev' });
  expect(() => paymentProviders()).toThrow(/deneme/);
  withEnv({ NODE_ENV: 'development', PAYMENTS_MODE: 'live' });
  expect(() => paymentProviders()).toThrow(/bağlanmadı/);
  withEnv({ NODE_ENV: 'development', PAYMENTS_MODE: 'dev' });
  expect(paymentProviders().web).toBeInstanceOf(DevWebPayment);
});
