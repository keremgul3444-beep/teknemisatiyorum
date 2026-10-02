import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const draft = {
  brand: 'Sayac', model: 'Test', year: 2016, lengthM: 12.2, type: 'yelkenli', price: 100000, currency: 'EUR',
  location: 'Bodrum', equipment: [], cabins: 3, engine: '', description: '',
};
const tick = () => new Promise((r) => setTimeout(r, 50));

test('satıcı istatistikleri: görüntülenme (sahibi hariç), favori ve mesaj sayısı; ilanın site adresi', async () => {
  const owner = await loginAs(t, { level: 2 });
  const buyer = await loginAs(t);
  const l = await t.prisma.listing.create({ data: { ...draft, ownerId: owner.user.id, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] } });

  expect((await t.http().get(`/listings/${l.id}`)).status).toBe(200); // misafir
  expect((await t.http().get(`/listings/${l.id}`).set(buyer.auth)).status).toBe(200);
  expect((await t.http().get(`/listings/${l.id}`).set(owner.auth)).status).toBe(200); // sahibi: sayılmaz
  await t.http().put(`/favorites/${l.id}`).set(buyer.auth).expect(204);
  expect((await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: l.id })).status).toBe(201);
  await tick();

  const mine = await t.http().get('/me/listings').set(owner.auth);
  const row = mine.body.find((x: { id: string }) => x.id === l.id);
  expect(row.stats).toEqual({ views: 2, favorites: 1, messages: 1 });
  expect(row.webUrl).toBe(`http://localhost:3001/ilan/${l.id}`);

  // Aynı kişinin yeniden açması 30 dakika içinde sayılmaz; sitenin ara katmanı ("sayma" başlığı) hiç sayılmaz.
  await t.http().get(`/listings/${l.id}`).set(buyer.auth);
  await t.http().get(`/listings/${l.id}`).set('X-Tms-No-Count', '1').set('X-Forwarded-For', '203.0.113.9');
  await tick();
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).viewCount).toBe(2);

  // İstatistik yalnızca sahibine; herkese açık görünümde yok.
  const pub = await t.http().get(`/listings/${l.id}`).set(buyer.auth);
  expect(pub.body.stats).toBeUndefined();
  expect(pub.body.webUrl).toBe(`http://localhost:3001/ilan/${l.id}`);
});

test('sitedeki ziyaret ayrı uçtan bir kez sayılır; satıcının kendisi, yayında olmayan ve bilinmeyen ilan sayılmaz', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await t.prisma.listing.create({ data: { ...draft, ownerId: owner.user.id, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] } });
  const pending = await t.prisma.listing.create({ data: { ...draft, ownerId: owner.user.id, currency: 'EUR', type: 'yelkenli', status: 'pending', badges: [] } });
  expect((await t.http().post(`/listings/${l.id}/view`)).status).toBe(204);
  expect((await t.http().post(`/listings/${l.id}/view`)).status).toBe(204); // aynı ziyaretçi, sayılmaz
  expect((await t.http().post(`/listings/${l.id}/view`).set(owner.auth)).status).toBe(204); // satıcı, sayılmaz
  expect((await t.http().post(`/listings/${pending.id}/view`)).status).toBe(204);
  expect((await t.http().post('/listings/yokboyleilan123/view')).status).toBe(204);
  await tick();
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).viewCount).toBe(1);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: pending.id } })).viewCount).toBe(0);
});
