import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

async function publish(ownerAuth: Record<string, string>, extra: Record<string, unknown> = {}) {
  const r = await t.http().post('/listings').set(ownerAuth).send({ brand: 'Promo', model: 'X', year: 2019, lengthM: 11, type: 'yelkenli', price: 100000, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date(), ...extra } });
  return r.body.id as string;
}

test('ilan görünümü vitrin/acil bayraklarını taşır; bitişleri yalnızca sahip görür', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await publish(owner.auth, { featuredUntil: new Date(Date.now() + 864e5), urgentUntil: new Date(Date.now() - 1000) });
  const pub = await t.http().get(`/listings/${id}`);
  expect(pub.body.promo).toEqual({ featured: true, urgent: false });
  const mine = await t.http().get(`/listings/${id}`).set(owner.auth);
  expect(mine.body.promo.featuredUntil).toBeTruthy();
});
