import { buildEvent, frames, parseDsn, reportError, resetReportWindow, REPORTS_PER_MINUTE } from './error-report';
import { resetEnvCache } from '../config/env';

const saved = { ...process.env };
const base = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40), ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 'w'.repeat(40) };
beforeEach(() => { Object.assign(process.env, base); resetEnvCache(); resetReportWindow(); });
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

test('DSN: Sentry ve alt yollu GlitchTip adresleri olay ucuna çevrilir; bozuk DSN yok sayılır', () => {
  expect(parseDsn('https://abc@o1.ingest.sentry.io/42')).toEqual({ url: 'https://o1.ingest.sentry.io/api/42/envelope/', key: 'abc' });
  expect(parseDsn('https://k@hata.ornek.com/gt/7')).toEqual({ url: 'https://hata.ornek.com/gt/api/7/envelope/', key: 'k' });
  expect(parseDsn('')).toBeNull();
  expect(parseDsn('https://hata.ornek.com/7')).toBeNull();
});

test('yığın izi çerçevelere çevrilir, en eski çağrı başta; bağımlılıklar uygulama kodu sayılmaz', () => {
  const f = frames('Error: x\n    at inner (/app/dist/src/a.js:10:5)\n    at /app/node_modules/lib/b.js:3:1\n    at node:internal/x:1:1');
  expect(f.map((x) => x.filename)).toEqual(['node:internal/x', '/app/node_modules/lib/b.js', '/app/dist/src/a.js']);
  expect(f[2]).toMatchObject({ function: 'inner', lineno: 10, colno: 5, in_app: true });
  expect(f[1].in_app).toBe(false);
});

test('olay yalnızca hata, yol kalıbı ve yöntemi taşır; mesaj kısaltılır', () => {
  const ev = buildEvent(new TypeError('a'.repeat(900)), { route: '/listings/:id', method: 'GET' });
  expect(ev.exception.values[0]).toMatchObject({ type: 'TypeError' });
  expect(ev.exception.values[0].value).toHaveLength(500);
  expect(ev.tags).toEqual({ route: '/listings/:id', method: 'GET' });
  expect(ev.event_id).toMatch(/^[0-9a-f]{32}$/);
});

test('DSN yoksa gönderilmez; varsa zarf doğru başlıkla gider; dakikalık sınır aşılmaz; ağ hatası yutulur', async () => {
  const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fake = async (url: string, init: { headers: Record<string, string>; body: string }) => { sent.push({ url, ...init }); };
  expect(await reportError(new Error('x'), {}, fake)).toBe(false);
  process.env.ERROR_DSN = 'https://anahtar@hata.ornek.com/3';
  resetEnvCache();
  expect(await reportError(new Error('patladı'), { job: 'backup' }, fake)).toBe(true);
  expect(sent[0].url).toBe('https://hata.ornek.com/api/3/envelope/');
  expect(sent[0].headers['X-Sentry-Auth']).toContain('sentry_key=anahtar');
  const lines = sent[0].body.trim().split('\n').map((l) => JSON.parse(l));
  expect(lines[1]).toEqual({ type: 'event' });
  expect(lines[2].exception.values[0].value).toBe('patladı');
  expect(lines[2].tags).toEqual({ job: 'backup' });
  for (let i = 0; i < REPORTS_PER_MINUTE + 5; i++) await reportError(new Error('fırtına'), {}, fake);
  expect(sent).toHaveLength(REPORTS_PER_MINUTE);
  resetReportWindow();
  expect(await reportError(new Error('x'), {}, async () => { throw new Error('ağ yok'); })).toBe(false);
});
