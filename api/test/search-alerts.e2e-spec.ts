import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const settle = () => new Promise((ok) => setTimeout(ok, 300));
const saved = (userId: string, filter: Record<string, unknown>) =>
  t.prisma.savedSearch.create({ data: { userId, text: 'kayıtlı', filter: { equipment: [], ...filter } } });
const alerts = (userId: string) => t.prisma.notification.count({ where: { userId, key: 'notif.searchMatch' } });

async function approve(listingId: string, mod: { auth: Record<string, string> }) {
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
  const r = await t.http().post(`/admin/listings/${listingId}/decision`).set(mod.auth).send({ decision: 'approve', version: l.updatedAt.toISOString() });
  expect(r.status).toBe(200);
  await settle();
}

test('onaylanan ilan kayıtlı aramalarla eşleşir: uyana tek bildirim; uymayana, sahibine, bildirimi kapatana ve silinmiş hesaba gitmez; yeniden onayda tekrarlanmaz', async () => {
  const seller = await loginAs(t, { level: 2 });
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const fan = await loginAs(t);
  const other = await loginAs(t);
  const muted = await loginAs(t);
  const gone = await loginAs(t);
  await saved(fan.user.id, { type: 'yelkenli', location: 'bodrum', maxLength: 12 });
  await saved(fan.user.id, { type: 'yelkenli' });
  await saved(other.user.id, { type: 'motoryat' });
  await saved(seller.user.id, { type: 'yelkenli' });
  await saved(muted.user.id, { type: 'yelkenli' });
  await t.prisma.user.update({ where: { id: muted.user.id }, data: { prefs: { notifyMessages: true, notifyMatches: false, notifyMarketing: false, phoneVisible: false, marketingConsent: false } } });
  await saved(gone.user.id, { type: 'yelkenli' });
  await t.prisma.user.update({ where: { id: gone.user.id }, data: { deletedAt: new Date() } });

  const l = await t.prisma.listing.create({
    data: { ownerId: seller.user.id, brand: 'Bavaria', model: 'C34', year: 2018, lengthM: 10.5, type: 'yelkenli', price: 90000, currency: 'EUR', location: 'Bodrum', status: 'pending' },
  });
  await approve(l.id, mod);
  expect(await alerts(fan.user.id)).toBe(1);
  const n = await t.prisma.notification.findFirstOrThrow({ where: { userId: fan.user.id, key: 'notif.searchMatch' } });
  expect(n.params).toMatchObject({ listingId: l.id, title: 'Bavaria C34' });
  for (const u of [other, seller, muted, gone]) expect(await alerts(u.user.id)).toBe(0);

  await t.prisma.listing.update({ where: { id: l.id }, data: { status: 'pending', description: 'düzenlendi' } });
  await approve(l.id, mod);
  expect(await alerts(fan.user.id)).toBe(1);
});

test('reddedilen ilan bildirim göndermez', async () => {
  const seller = await loginAs(t, { level: 2 });
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const fan = await loginAs(t);
  await saved(fan.user.id, { type: 'gulet' });
  const l = await t.prisma.listing.create({
    data: { ownerId: seller.user.id, brand: 'Gulet', model: 'X', year: 2010, lengthM: 24, type: 'gulet', price: 1, currency: 'EUR', location: 'Marmaris', status: 'pending' },
  });
  await t.http().post(`/admin/listings/${l.id}/decision`).set(mod.auth).send({ decision: 'reject', reason: 'rules', version: l.updatedAt.toISOString() }).expect(200);
  await settle();
  expect(await alerts(fan.user.id)).toBe(0);
});

test('okunmamış bildirim sayısı ve hepsini okundu yapma yalnızca kendi bildirimlerini etkiler', async () => {
  const a = await loginAs(t);
  const b = await loginAs(t);
  for (const u of [a, a, b]) await t.prisma.notification.create({ data: { userId: u.user.id, key: 'notif.listingApproved', params: { title: 'x' } } });
  expect((await t.http().get('/notifications/unread-count').set(a.auth)).body).toEqual({ count: 2 });
  await t.http().post('/notifications/read-all').set(a.auth).expect(204);
  expect((await t.http().get('/notifications/unread-count').set(a.auth)).body).toEqual({ count: 0 });
  expect((await t.http().get('/notifications/unread-count').set(b.auth)).body).toEqual({ count: 1 });
  expect((await t.http().get('/notifications/unread-count')).status).toBe(401);
});
