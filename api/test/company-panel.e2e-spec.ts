import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const listing = (ownerId: string, companyId: string) => t.prisma.listing.create({ data: {
  brand: 'Firma', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, companyId, status: 'published', publishedAt: new Date(),
} });

test('firma paneli: üyeler görür, istatistik yalnız yöneticiye; personel çıkarılınca ilanı bireysele döner', async () => {
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
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).companyId).toBeNull();
});
