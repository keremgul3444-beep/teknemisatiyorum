import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { normalizeListingLocations } from '../src/modules/listings/location-backfill';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const draft = {
  brand: 'Konum', model: 'Test', year: 2016, lengthM: 12.2, type: 'yelkenli', price: 180000, currency: 'EUR',
  location: 'bodrum  ', equipment: [], cabins: 3, engine: '', description: '',
};
const row = (ownerId: string, location: string) => t.prisma.listing.create({
  data: { ...draft, ownerId, location, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] },
});

test('ilan kaydında konum tek biçime iner (oluşturma ve düzenleme)', async () => {
  const a = await loginAs(t);
  const c = await t.http().post('/listings').set(a.auth).send(draft);
  expect(c.body.location).toBe('Bodrum');
  const p = await t.http().patch(`/listings/${c.body.id}`).set(a.auth).send({ location: 'GÖCEK' });
  expect(p.body.location).toBe('Göcek');
});

test('aramada küçük harfle yazılan konum da bulunur', async () => {
  const a = await loginAs(t);
  const l = await row(a.user.id, 'Marmaris');
  const q = encodeURIComponent(JSON.stringify({ location: 'marmaris', equipment: [] }));
  const r = await t.http().get(`/listings?q=${q}`);
  expect(r.body.items.map((x: { id: string }) => x.id)).toContain(l.id);
});

test('eski kayıtlar bir kerelik düzeltilir; site haritasında tek şehir sayılır', async () => {
  const a = await loginAs(t);
  for (const loc of ['Antalya', 'antalya', ' ANTALYA ']) await row(a.user.id, loc);
  expect(await normalizeListingLocations(t.prisma)).toBe(2);
  expect(await normalizeListingLocations(t.prisma)).toBe(0); // tekrar çalışması zararsız
  const facets = (await t.http().get('/listings/sitemap')).body.facets as { type: string; location: string | null; count: number }[];
  expect(facets.filter((f) => f.location?.toLocaleLowerCase('tr-TR').trim() === 'antalya')).toEqual([{ type: 'yelkenli', location: 'Antalya', count: 3 }]);
});
