import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { env, resetEnvCache } from '../config/env';
import type { Storage } from '../adapters/storage';
import { openBackup, pushOffsite, sealBackup } from './backup';

const base = {
  NODE_ENV: 'test', DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(40),
  ID_ENC_KEY: Buffer.alloc(32, 1).toString('base64'), PAYMENT_WEBHOOK_SECRET: 's'.repeat(40),
};
const saved = { ...process.env };
const withEnv = (e: Record<string, string> = {}) => { Object.assign(process.env, base, e); resetEnvCache(); };
afterEach(() => { process.env = { ...saved }; resetEnvCache(); });

test('yedek şifrelenir ve aynı anahtarla açılır; başka anahtarla açılmaz', () => {
  withEnv();
  const plain = Buffer.from(JSON.stringify({ tables: { user: [{ phone: '+905321234567' }] } }));
  const sealed = sealBackup(plain);
  expect(sealed.includes(Buffer.from('+905321234567'))).toBe(false);
  expect(openBackup(sealed).equals(plain)).toBe(true);
  withEnv({ ID_ENC_KEY: Buffer.alloc(32, 2).toString('base64') });
  expect(() => openBackup(sealed)).toThrow();
});

test('bulut yedeği günün anahtarına yazılır, 30 günlükten eskisi silinir', async () => {
  withEnv();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'yedek-'));
  const file = path.join(dir, '2026-10-03.json');
  await fs.writeFile(file, '{"tables":{}}');
  const ops: string[] = [];
  const storage: Storage = { put: async (k) => { ops.push(`put ${k}`); }, get: async () => null, remove: async (k) => { ops.push(`rm ${k}`); } };
  await pushOffsite(storage, file, new Date('2026-10-03T03:00:00Z'));
  expect(ops).toEqual(['put backups/2026-10-03.json.enc', 'rm backups/2026-09-03.json.enc']);
});

test('bulut seçilip ayarı eksikse sunucu açılmaz', () => {
  withEnv({ STORAGE_DRIVER: 's3', S3_BUCKET: 'tms' });
  expect(() => env()).toThrow(/S3_ENDPOINT/);
  withEnv({ STORAGE_DRIVER: 'local', BACKUP_OFFSITE: '1' });
  expect(() => env()).toThrow(/BACKUP_OFFSITE/);
});
