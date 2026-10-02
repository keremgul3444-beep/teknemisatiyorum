import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const DAY = 864e5;
const draft = {
  brand: 'Fiyat', model: 'Test', year: 2016, lengthM: 12.2, type: 'yelkenli', price: 100000, currency: 'EUR',
  location: 'Bodrum', equipment: [], cabins: 3, engine: '', description: '',
};
async function published(ownerId: string, data: Record<string, unknown> = {}) {
  return t.prisma.listing.create({ data: { ...draft, ...data, ownerId, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] } });
}

test('yalnızca fiyat düşürülünce ilan yayında kalır, "fiyat düştü" görünür ve favorileyen haber alır', async () => {
  const owner = await loginAs(t, { level: 2 });
  const buyer = await loginAs(t);
  const l = await published(owner.user.id);
  expect((await t.http().put(`/favorites/${l.id}`).set(buyer.auth)).status).toBe(204);

  const r = await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 90000 });
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('published');
  expect(r.body.priceDrop).toMatchObject({ previousPrice: 100000 });

  const n = await t.http().get('/notifications').set(buyer.auth);
  expect(n.body.find((x: { key: string }) => x.key === 'notif.priceDrop')).toMatchObject({ params: { listingId: l.id, title: 'Fiyat Test', from: '100000', to: '90000', currency: 'EUR' } });
  // İlan sahibine kendi indirimi için bildirim gitmez.
  expect((await t.http().get('/notifications').set(owner.auth)).body.find((x: { key: string }) => x.key === 'notif.priceDrop')).toBeUndefined();

  // Herkese açık görünümde de var; arama "fiyatı düşenler" süzgeciyle bulur.
  expect((await t.http().get(`/listings/${l.id}`)).body.priceDrop.previousPrice).toBe(100000);
  const other = await published(owner.user.id, { brand: 'Sabit' });
  const ids = (await t.http().get('/listings?drop=1')).body.items.map((x: { id: string }) => x.id);
  expect(ids).toContain(l.id);
  expect(ids).not.toContain(other.id);
  expect((await t.http().get('/listings/showcase')).body.priceDrops.map((x: { id: string }) => x.id)).toContain(l.id);
});

test('fiyat yükselince ya da indirim 30 günden eskiyse rozet yok; başka alanla birlikte değişiklik onaya düşer', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await published(owner.user.id);
  await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 80000 });
  const up = await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 95000 });
  expect(up.status).toBe(200);
  expect(up.body.priceDrop).toBeNull();
  // Yalnızca fiyat gönderilince diğer alanlar (açıklama, donanım) silinmez.
  expect(up.body.description).toBe(draft.description);

  const old = await published(owner.user.id, { brand: 'Eski' });
  await t.http().patch(`/listings/${old.id}`).set(owner.auth).send({ price: 70000 });
  await t.prisma.priceHistory.updateMany({ where: { listingId: old.id }, data: { at: new Date(Date.now() - 40 * DAY) } });
  expect((await t.http().get(`/listings/${old.id}`)).body.priceDrop).toBeNull();

  const mixed = await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 60000, description: 'Yeni açıklama' });
  expect(mixed.body.status).toBe('pending');
});
