import fs from 'fs';
import os from 'os';
import path from 'path';
import { createTestApp, type TestApp } from './setup';
import { runBackup } from '../src/backup/backup';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

test('tüm tablolar günlük dosyaya yazılır, son 7 yedek tutulur', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-backup-'));
  await t.prisma.user.create({ data: { phone: '+905559990001', name: 'Yedek Test' } });
  for (let d = 1; d <= 9; d++) await runBackup(t.prisma, dir, new Date(Date.UTC(2026, 8, d)));
  const files = fs.readdirSync(dir).sort();
  expect(files).toHaveLength(7);
  expect(files[0]).toBe('2026-09-03.json');
  const data = JSON.parse(fs.readFileSync(path.join(dir, '2026-09-09.json'), 'utf8'));
  expect(data.tables.user.some((u: { name: string }) => u.name === 'Yedek Test')).toBe(true);
  expect(Object.keys(data.tables)).toEqual(expect.arrayContaining(['listing', 'boat', 'logbookEntry', 'message', 'auditLog']));
});

test('aynı gün ikinci kez çalışınca dosya üzerine yazılır', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-backup-'));
  await runBackup(t.prisma, dir, new Date(Date.UTC(2026, 8, 10)));
  await runBackup(t.prisma, dir, new Date(Date.UTC(2026, 8, 10)));
  expect(fs.readdirSync(dir)).toEqual(['2026-09-10.json']);
});
