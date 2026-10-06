import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const listing = (ownerId: string, companyId: string) => t.prisma.listing.create({ data: {
  brand: 'Firma', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, companyId, status: 'published', publishedAt: new Date(),
} });

test('firma paneli: üyeler görür, istatistik yalnız yöneticiye; personel çıkarılınca firma ilanı firmada kalır', async () => {
  const owner = await loginAs(t, { level: 2 });
  const staff = await loginAs(t, { level: 2 });
  const outsider = await loginAs(t, { level: 2 });
  const c = (await t.http().post('/companies').set(owner.auth).send({ name: 'Panel Yat', kind: 'galeri', city: 'Bodrum' })).body;
  await t.http().post(`/companies/${c.id}/members`).set(owner.auth).send({ phone: staff.user.phone, role: 'staff' }).expect(201);
  const l = await listing(staff.user.id, c.id);

  const own = (await t.http().get(`/companies/${c.id}`).set(owner.auth)).body;
  expect(own.myRole).toBe('owner');
  expect(own.members).toHaveLength(2);
  expect(JSON.stringify(own.members)).not.toContain(staff.user.phone);
  expect(own.listings.find((x: { id: string }) => x.id === l.id).stats).toEqual({ views: 0, favorites: 0, messages: 0 });
  const st = (await t.http().get(`/companies/${c.id}`).set(staff.auth)).body;
  expect(st.listings[0].stats).toBeUndefined();
  expect((await t.http().get(`/companies/${c.id}`).set(outsider.auth)).status).toBe(404);

  expect((await t.http().delete(`/companies/${c.id}/members/${owner.user.id}`).set(owner.auth)).body.code).toBe('OWNER_LOCKED');
  expect((await t.http().delete(`/companies/${c.id}/members/${owner.user.id}`).set(staff.auth)).status).toBe(404);
  await t.http().delete(`/companies/${c.id}/members/${staff.user.id}`).set(owner.auth).expect(204);
  // Firma sahibi personelin ilanını sahibi gibi görür ve düzenler; diğer personel ve dışarıdan biri dokunamaz.
  expect((await t.http().get(`/me/listings/${l.id}`).set(owner.auth)).body).toMatchObject({ id: l.id, isMine: true });
  await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ description: 'Firma düzenledi' }).expect(200);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).pendingChanges).toMatchObject({ description: 'Firma düzenledi' });
  expect((await t.http().get(`/me/listings/${l.id}`).set(outsider.auth)).status).toBe(404);
  const s3 = await loginAs(t, { level: 2 });
  await t.http().post(`/companies/${c.id}/members`).set(owner.auth).send({ phone: s3.user.phone, role: 'staff' }).expect(201);
  expect((await t.http().patch(`/listings/${l.id}`).set(s3.auth).send({ description: 'x' })).status).toBe(404);
  await t.prisma.product.upsert({ where: { code: 'vitrin_7' }, create: { code: 'vitrin_7', kind: 'vitrin', days: 7, priceWebKurus: 100, priceAppKurus: 100 }, update: {} });
  const order = await t.http().post('/orders').set(owner.auth).send({ listingId: l.id, productCode: 'vitrin_7', accept: true });
  expect(order.status).toBeLessThan(400);
  expect((await t.http().post('/orders').set(s3.auth).send({ listingId: l.id, productCode: 'vitrin_7', accept: true })).status).toBe(404);

  // Envanter firmanın: ilan firmada kalır, firma sahibine geçer; personele bildirim gider.
  expect(await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ companyId: c.id, ownerId: owner.user.id });
  expect(await t.prisma.notification.count({ where: { userId: staff.user.id, key: 'notif.companyRemoved' } })).toBe(1);

  // Personel kendisi ayrılabilir; sahip ayrılamaz.
  const s2 = await loginAs(t, { level: 2 });
  await t.http().post(`/companies/${c.id}/members`).set(owner.auth).send({ phone: s2.user.phone, role: 'staff' }).expect(201);
  const l2 = await listing(s2.user.id, c.id);
  await t.http().post(`/companies/${c.id}/leave`).set(s2.auth).expect(204);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l2.id } })).ownerId).toBe(owner.user.id);
  expect((await t.http().post(`/companies/${c.id}/leave`).set(owner.auth)).body.code).toBe('OWNER_LOCKED');
});
