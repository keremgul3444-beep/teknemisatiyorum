import { createTestApp, type TestApp } from './setup';
import sharp from 'sharp';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const listing = (ownerId: string, status: 'published' | 'pending') => t.prisma.listing.create({ data: {
  brand: 'Kopya', model: status, year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, status, publishedAt: status === 'published' ? new Date() : null,
} });

test('başka satıcının ilanındaki fotoğraf onay kuyruğunda uyarı olarak görünür', async () => {
  const real = await loginAs(t, { level: 2 });
  const thief = await loginAs(t, { level: 2 });
  // Dokulu görsel (düz renkli görselin izi karşılaştırmaya girmez).
  const raw = Buffer.alloc(600 * 400 * 3);
  for (let i = 0; i < raw.length; i += 3) { const x = (i / 3) % 600; const y = Math.floor(i / 3 / 600); raw[i] = (x * 3 + y) % 256; raw[i + 1] = (y * 5) % 256; raw[i + 2] = (x ^ y) % 256; }
  const img = await sharp(raw, { raw: { width: 600, height: 400, channels: 3 } }).jpeg().toBuffer();
  const up = async (auth: Record<string, string>) => (await t.http().post('/media').set(auth).field('visibility', 'public').attach('file', img, 'p.jpg')).body.id as string;
  const original = await listing(real.user.id, 'published');
  await t.prisma.listingPhoto.create({ data: { listingId: original.id, fileId: await up(real.auth), order: 0 } });
  const copy = await listing(thief.user.id, 'pending');
  await t.prisma.listingPhoto.create({ data: { listingId: copy.id, fileId: await up(thief.auth), order: 0 } });

  const m = await loginAs(t, { level: 3, roles: ['moderator'] });
  const q = await t.http().get('/admin/queue?kind=listing').set(m.auth);
  const item = q.body.find((x: { id: string }) => x.id === copy.id);
  expect(item.photoDuplicates).toEqual(expect.arrayContaining([{ listingId: original.id, title: 'Kopya published', status: 'published', sameOwner: false }]));
  expect(await t.prisma.file.count({ where: { ownerId: thief.user.id, phash: { not: null } } })).toBe(1);
});
