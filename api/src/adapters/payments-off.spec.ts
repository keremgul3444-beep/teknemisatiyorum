import { resetEnvCache } from '../config/env';
import { assertPaymentsOn, paymentProviders } from './payments';

const base = {
  NODE_ENV: 'production', PUBLIC_URL: 'https://api.test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40),
  ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 's'.repeat(40),
};
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

test('ödeme kapalıyken canlı sunucu açılır; ödeme başlatma anlaşılır hatayla reddedilir', async () => {
  Object.assign(process.env, base, { PAYMENTS_MODE: 'off' });
  resetEnvCache();
  const p = paymentProviders();
  const code = (e: unknown) => ((e as { getResponse(): { code: string } }).getResponse()).code;
  expect(code(await p.web.createCheckout({ orderId: 'o', amountKurus: 100 }).catch((e) => e))).toBe('PAYMENTS_DISABLED');
  expect(code(await p.store.verify('ios', 'x').catch((e) => e))).toBe('PAYMENTS_DISABLED');
  expect(() => assertPaymentsOn()).toThrow();
});
