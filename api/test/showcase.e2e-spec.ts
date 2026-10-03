import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const DAY = 864e5;
// Taslaklar sırayla açılır: aynı anda 5'ten fazla açık taslak sınırına takılır (TOO_MANY_DRAFTS); her taslak hemen yayına alınır.
let chain: Promise<unknown> = Promise.resolve();
function listing(ownerAuth: Record<string, string>, data: Record<string, unknown>): Promise<string> {
  const next = chain.then(() => create(ownerAuth, data));
  chain = next.catch(() => undefined);
  return next;
}
async function create(ownerAuth: Record<string, string>, data: Record<string, unknown>) {
  const r = await t.http().post('/listings').set(ownerAuth).send({ brand: 'S', model: `M${Math.random().toString(36).slice(2, 7)}`, year: 2015, lengthM: 10, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date(Date.now() - 10 * DAY), ...data } });
  return r.body.id as string;
}

test('arama: aramaya uyan en fazla 3 vitrin ilanı üstte; normal listede de yerinde', async () => {
  const u = await loginAs(t, { level: 2 });
  const f = await Promise.all([1, 2, 3, 4].map(() => listing(u.auth, { featuredUntil: new Date(Date.now() + DAY) })));
  const expired = await listing(u.auth, { featuredUntil: new Date(Date.now() - DAY) });
  const sold = await listing(u.auth, { featuredUntil: new Date(Date.now() + DAY) });
  await t.prisma.listing.update({ where: { id: sold }, data: { status: 'sold' } });
  const r = await t.http().get('/listings');
  expect(r.body.featuredTop).toHaveLength(3);
  for (const x of r.body.featuredTop) expect(f).toContain(x.id);
  expect(r.body.featuredTop.map((x: { id: string }) => x.id)).not.toContain(expired);
  expect(r.body.featuredTop.map((x: { id: string }) => x.id)).not.toContain(sold);
  expect(r.body.items.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(f));
});

test('üste taşınan ilan "en yeni" sıralamada başa geçer; sadece acil filtresi', async () => {
  const u = await loginAs(t, { level: 2 });
  const bumped = await listing(u.auth, { location: 'Göcek', bumpedAt: new Date() });
  await listing(u.auth, { location: 'Göcek', publishedAt: new Date(Date.now() - DAY) });
  const q = encodeURIComponent(JSON.stringify({ equipment: [], location: 'Göcek' }));
  expect((await t.http().get(`/listings?q=${q}&sort=new`)).body.items[0].id).toBe(bumped);
  const urgent = await listing(u.auth, { location: 'Göcek', urgentUntil: new Date(Date.now() + DAY) });
  const r = await t.http().get(`/listings?q=${q}&urgent=1`);
  expect(r.body.items.map((x: { id: string }) => x.id)).toEqual([urgent]);
});

test('vitrin uç noktası: ≤8 vitrin, ≤8 acil; yalnızca yayındaki ve süresi geçerli', async () => {
  const u = await loginAs(t, { level: 2 });
  await Promise.all(Array.from({ length: 10 }, () => listing(u.auth, { featuredUntil: new Date(Date.now() + DAY), urgentUntil: new Date(Date.now() + DAY) })));
  const r = await t.http().get('/listings/showcase');
  expect(r.body.featured.length).toBe(8);
  expect(r.body.urgent.length).toBe(8);
  expect(r.body.featured.every((x: { promo: { featured: boolean } }) => x.promo.featured)).toBe(true);
});

test('site haritası: yalnızca yayındaki ilanlar ve tip/şehir sayıları', async () => {
  const u = await loginAs(t, { level: 2 });
  const live = await listing(u.auth, { location: 'Fethiye', type: 'motoryat' });
  const removed = await listing(u.auth, { location: 'Fethiye', type: 'motoryat' });
  await t.prisma.listing.update({ where: { id: removed }, data: { status: 'removed' } });
  const r = await t.http().get('/listings/sitemap');
  const ids = r.body.listings.map((x: { id: string }) => x.id);
  expect(ids).toContain(live);
  expect(ids).not.toContain(removed);
  expect(r.body.facets).toEqual(expect.arrayContaining([{ type: 'motoryat', location: 'Fethiye', count: 1 }, { type: 'motoryat', location: null, count: expect.any(Number) }]));
});

test('vitrin uç noktası: satılan ya da kaldırılan ilan süresi dolmasa da görünmez', async () => {
  const u = await loginAs(t, { level: 2 });
  // Önceki testlerin vitrinleri kapatılır: uç nokta en fazla 8'i rastgele seçtiği için sonuç şansa kalmasın.
  await t.prisma.listing.updateMany({ data: { featuredUntil: null, urgentUntil: null } });
  const promo = { featuredUntil: new Date(Date.now() + DAY), urgentUntil: new Date(Date.now() + DAY) };
  const live = await listing(u.auth, promo);
  const sold = await listing(u.auth, { ...promo, status: 'sold' });
  const removed = await listing(u.auth, { ...promo, status: 'removed' });
  const r = await t.http().get('/listings/showcase');
  const ids = [...r.body.featured, ...r.body.urgent].map((x: { id: string }) => x.id);
  expect(ids).not.toContain(sold);
  expect(ids).not.toContain(removed);
  expect(r.body.featured.map((x: { id: string }) => x.id)).toEqual([live]);
  expect(r.body.urgent.map((x: { id: string }) => x.id)).toEqual([live]);
});
