import { spawnSync } from 'child_process';
import path from 'path';
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { parseArgs } from '../scripts/cleanup-accounts';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/cleanup-accounts.ts', ...args], {
  cwd: path.resolve(__dirname, '..'), env: process.env, encoding: 'utf8',
});

test('argümanlar: numara biçimi denetlenir, --apply ayrılır', () => {
  expect(parseArgs(['+905321112233', '--apply'])).toEqual({ apply: true, phones: ['+905321112233'], bad: [] });
  expect(parseArgs(['05321112233']).bad).toEqual(['05321112233']);
});

test('deneme hesabı temizliği: önizleme dokunmaz; --apply hesabı anonimleştirir, ilanı kaldırır; ekip hesabı atlanır; iz saklanmaz', async () => {
  const u = await loginAs(t, { level: 2, name: 'Beta Deneme' });
  const l = await t.prisma.listing.create({
    data: { ownerId: u.user.id, brand: 'Beta', model: 'T', year: 2015, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum', status: 'published', publishedAt: new Date() },
  });
  const reporter = await loginAs(t);
  await t.prisma.listingReport.create({ data: { listingId: l.id, reporterId: reporter.user.id, reason: 'scam' } });
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });

  const dry = run(u.user.phone!, admin.user.phone!);
  expect(dry.status).toBe(0);
  expect(dry.stdout).toContain('silinecek');
  expect(dry.stdout).toContain('atlandı (ekip)');
  expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.user.id } })).deletedAt).toBeNull();

  const r = run(u.user.phone!, admin.user.phone!, '--apply');
  expect(r.status).toBe(0);
  const after = await t.prisma.user.findUniqueOrThrow({ where: { id: u.user.id } });
  expect(after).toMatchObject({ phone: null, name: null });
  expect(after.deletedAt).not.toBeNull();
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('removed');
  expect((await t.prisma.user.findUniqueOrThrow({ where: { id: admin.user.id } })).deletedAt).toBeNull();
  expect(await t.prisma.deletedIdentity.count({ where: { deletedUserId: u.user.id } })).toBe(0);

  expect(run('0532').status).toBe(1);
});
