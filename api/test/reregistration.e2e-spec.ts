import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { DevSmsSender } from '../src/adapters/sms';
import { phoneIndex, purgeDeletedIdentities, RETENTION_DAYS } from '../src/modules/users/reregistration';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

async function otpLogin(phone: string) {
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  const code = t.app.get(DevSmsSender).inbox().filter((m) => m.phone === phone).at(-1)!.code;
  const r = await t.http().post('/auth/verify').send({ phone, code, deviceName: 'test' });
  expect(r.status).toBe(200);
  return { id: r.body.user.id as string, auth: { Authorization: `Bearer ${r.body.accessToken}` } };
}
async function reportedSeller() {
  const u = await loginAs(t, { level: 2 });
  const l = await t.prisma.listing.create({
    data: { ownerId: u.user.id, brand: 'Şüp', model: 'H', year: 2015, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum', status: 'published', publishedAt: new Date() },
  });
  const r = await loginAs(t);
  await t.prisma.listingReport.create({ data: { listingId: l.id, reporterId: r.user.id, reason: 'scam' } });
  return u;
}

test('bildirimli ilanı olan hesap silinip aynı numarayla açılınca moderatöre işaretlenir; temiz hesap iz bırakmaz', async () => {
  const bad = await reportedSeller();
  await t.http().delete('/me').set(bad.auth).expect(204);
  expect(await t.prisma.deletedIdentity.count({ where: { deletedUserId: bad.user.id, hash: phoneIndex(bad.user.phone!) } })).toBe(1);

  const again = await otpLogin(bad.user.phone!);
  expect((await t.prisma.user.findUniqueOrThrow({ where: { id: again.id } })).reregisteredFrom).toBe(bad.user.id);
  expect(await t.prisma.auditLog.count({ where: { actorId: again.id, action: 'audit.reregistered' } })).toBe(1);
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const list = (await t.http().get('/admin/users').set(mod.auth)).body as { id: string; reregistered: boolean }[];
  expect(list.find((x) => x.id === again.id)?.reregistered).toBe(true);

  const clean = await loginAs(t, { level: 2 });
  await t.http().delete('/me').set(clean.auth).expect(204);
  expect(await t.prisma.deletedIdentity.count({ where: { deletedUserId: clean.user.id } })).toBe(0);
  const fresh = await otpLogin(clean.user.phone!);
  expect((await t.prisma.user.findUniqueOrThrow({ where: { id: fresh.id } })).reregisteredFrom).toBeNull();
});

test('izler saklama süresi dolunca silinir', async () => {
  const old = await t.prisma.deletedIdentity.create({ data: { hash: 'eski', deletedUserId: 'x', reason: 'reports', createdAt: new Date(Date.now() - (RETENTION_DAYS + 1) * 864e5) } });
  const keep = await t.prisma.deletedIdentity.create({ data: { hash: 'yeni', deletedUserId: 'y', reason: 'reports' } });
  await purgeDeletedIdentities(t.prisma);
  expect(await t.prisma.deletedIdentity.findUnique({ where: { id: old.id } })).toBeNull();
  expect(await t.prisma.deletedIdentity.findUnique({ where: { id: keep.id } })).not.toBeNull();
});
