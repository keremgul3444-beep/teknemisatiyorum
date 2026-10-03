import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { ListingExpiry, LISTING_DAYS } from '../src/modules/listings/expiry';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const DAY = 864e5;
const listing = (ownerId: string, expiresInDays: number) => t.prisma.listing.create({ data: {
  brand: 'Süre', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, status: 'published', publishedAt: new Date(),
  expiresAt: new Date(Date.now() + expiresInDays * DAY),
} });
const notifs = async (auth: Record<string, string>, key: string) => (await t.http().get('/notifications').set(auth)).body.filter((n: { key: string }) => n.key === key);

test('onay 90 günlük süre başlatır; süresi dolan ilan herkese kapanır ve sahibine haber gider', async () => {
  const owner = await loginAs(t, { level: 2 });
  const soon = await listing(owner.user.id, 3);
  const gone = await listing(owner.user.id, -1);
  const sweep = t.app.get(ListingExpiry);
  await sweep.sweep();
  await sweep.sweep(); // ikinci tarama aynı uyarıyı yinelemez
  expect(await notifs(owner.auth, 'notif.listingExpiring')).toHaveLength(1);
  expect(await notifs(owner.auth, 'notif.listingExpired')).toHaveLength(1);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: gone.id } })).status).toBe('expired');
  expect((await t.http().get(`/listings/${gone.id}`)).status).toBe(404);
  expect((await t.http().get(`/listings/${soon.id}`)).status).toBe(200);
  const mine = (await t.http().get('/me/listings').set(owner.auth)).body.find((x: { id: string }) => x.id === gone.id);
  expect(mine.status).toBe('expired');
  expect(mine.expiresAt).toBeTruthy();
});

test('yenileme: süresi dolan ya da bitişine 14 günden az kalan ilan onaysız 90 gün uzar; erken yenileme yok', async () => {
  const owner = await loginAs(t, { level: 2 });
  const gone = await listing(owner.user.id, -5);
  await t.prisma.listing.update({ where: { id: gone.id }, data: { status: 'expired' } });
  const r = await t.http().post(`/listings/${gone.id}/renew`).set(owner.auth);
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('published');
  expect(new Date(r.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + (LISTING_DAYS - 1) * DAY);
  const fresh = await listing(owner.user.id, 60);
  expect((await t.http().post(`/listings/${fresh.id}/renew`).set(owner.auth)).body.code).toBe('NOT_RENEWABLE');
  expect((await t.http().post(`/listings/${gone.id}/renew`).set((await loginAs(t)).auth)).status).toBe(404);
});

test('süresi dolan ilan düzenlenirse yeniden onaya düşer', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await listing(owner.user.id, -1);
  await t.prisma.listing.update({ where: { id: l.id }, data: { status: 'expired' } });
  const r = await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ description: 'Yeni açıklama' });
  expect(r.body.status).toBe('pending');
});

test('30 gün dokunulmamış taslak taramada kaldırılır', async () => {
  const owner = await loginAs(t, { level: 2 });
  const d = await t.prisma.listing.create({ data: {
    brand: 'Eski', model: 'Taslak', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum',
    equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId: owner.user.id, status: 'draft',
  } });
  await t.prisma.$executeRaw`UPDATE "Listing" SET "updatedAt" = NOW() - INTERVAL '31 days' WHERE id = ${d.id}`;
  await t.app.get(ListingExpiry).sweep();
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: d.id } })).status).toBe('removed');
});
