import { resetEnvCache, env } from '../config/env';
import { DevSmsSender, NetgsmSmsSender, TwilioSmsSender, smsSenderFor } from './sms';

const base = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40), ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 's'.repeat(40) };
const saved = { ...process.env };
const withEnv = (e: Record<string, string> = {}) => { Object.assign(process.env, base, e); resetEnvCache(); };
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

test('Netgsm: numara 10 hane, Türkçe kodlama, başlık; "00 iş no" başarı, hata kodu hata', async () => {
  withEnv({ SMS_MODE: 'netgsm', SMS_USER: '8501112233', SMS_PASSWORD: 'p', SMS_SENDER_NAME: 'TEKNEMSAT' });
  let url = '';
  const ok = (async (u: string) => { url = u; return new Response('00 123456789'); }) as unknown as typeof fetch;
  await new NetgsmSmsSender(env(), ok).sendOtp('+905321234567', '482913');
  const q = new URL(url).searchParams;
  expect(q.get('gsmno')).toBe('5321234567');
  expect(q.get('dil')).toBe('TR');
  expect(q.get('msgheader')).toBe('TEKNEMSAT');
  expect(q.get('message')).toContain('482913');
  const bad = (async () => new Response('30')) as unknown as typeof fetch;
  await expect(new NetgsmSmsSender(env(), bad).sendOtp('+905321234567', '1')).rejects.toThrow(/Netgsm/);
});

test('Twilio: yetki başlığı ve form gövdesi', async () => {
  withEnv({ SMS_MODE: 'twilio', SMS_USER: 'ACxx', SMS_PASSWORD: 'tok', SMS_SENDER_NAME: '+15550000' });
  let init: RequestInit = {};
  const ok = (async (_u: string, i: RequestInit) => { init = i; return new Response('{}', { status: 201 }); }) as unknown as typeof fetch;
  await new TwilioSmsSender(env(), ok).sendOtp('+905321234567', '111222');
  expect(String((init.headers as Record<string, string>).Authorization)).toBe(`Basic ${Buffer.from('ACxx:tok').toString('base64')}`);
  expect(String(init.body)).toContain('To=%2B905321234567');
});

test('üretimde sahte SMS ile açılmaz; eksik sağlayıcı ayarı açılışta söylenir', () => {
  withEnv({ NODE_ENV: 'production', PUBLIC_URL: 'https://api.test' });
  expect(() => smsSenderFor(new DevSmsSender())).toThrow(/SMS_MODE/);
  withEnv({ SMS_MODE: 'netgsm' });
  expect(() => env()).toThrow(/SMS_USER/);
});
