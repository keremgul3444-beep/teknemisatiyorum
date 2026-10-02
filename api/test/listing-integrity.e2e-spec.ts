import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const base = {
  brand: 'Bütün', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '',
};
const listing = (ownerId: string, data: Record<string, unknown> = {}) =>
  t.prisma.listing.create({ data: { ...base, ownerId, status: 'published', publishedAt: new Date(), ...data } as never });
const moderator = () => loginAs(t, { level: 3, roles: ['moderator'] });

test('ekspertiz rozeti yalnızca sahibin yaptırdığı ve yeterli puanlı rapordan', async () => {
  const owner = await loginAs(t, { level: 2 });
  const buyer = await loginAs(t);
  const pkg = await t.prisma.expertisePackage.create({ data: { name: 'Temel+', priceTry: 10000, items: [], order: 9 } });
  const m = await moderator();
  const book = async (auth: Record<string, string>, listingId: string) =>
    (await t.http().post('/expertise/bookings').set(auth).send({ packageId: pkg.id, listingId, date: '2026-10-03', slot: 'noon' })).body.id as string;
  const report = (id: string, score: number) => t.http().post(`/admin/expertise/${id}/report`).set(m.auth).send({ score }).expect(200);
  const badges = async (id: string) => (await t.prisma.listing.findUniqueOrThrow({ where: { id } })).badges;

  const a = await listing(owner.user.id);
  await report(await book(buyer.auth, a.id), 90);
  expect(await badges(a.id)).not.toContain('ekspertizli');
  const b = await listing(owner.user.id);
  await report(await book(owner.auth, b.id), 40);
  expect(await badges(b.id)).not.toContain('ekspertizli');
  await report(await book(owner.auth, b.id), 75);
  expect(await badges(b.id)).toContain('ekspertizli');
});

test('firma bağı kaldırılabilir; satıcı düzenlemeleri denetim kaydına düşer', async () => {
  const owner = await loginAs(t, { level: 2 });
  const company = (await t.http().post('/companies').set(owner.auth).send({ name: 'Liman Yat', kind: 'galeri', city: 'Bodrum' })).body;
  const l = await listing(owner.user.id, { companyId: company.id });
  const r = await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ companyId: null });
  expect(r.status).toBe(200);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).companyId).toBeNull();
  expect(await t.prisma.auditLog.findFirst({ where: { action: 'audit.listingEdited', targetId: l.id } })).toMatchObject({ actorId: owner.user.id, params: { fields: 'companyId' } });
  await t.http().delete(`/listings/${l.id}`).set(owner.auth).expect(204);
  expect(await t.prisma.auditLog.count({ where: { action: 'audit.listingWithdrawn', targetId: l.id } })).toBe(1);
});

test('eşzamanlı fotoğraf eklemede 20 sınırı aşılmaz', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await listing(owner.user.id, { status: 'draft', publishedAt: null });
  const ids: string[] = [];
  for (let i = 0; i < 22; i++) ids.push((await t.http().post('/media').set(owner.auth).field('visibility', 'public').attach('file', await jpegWithExif(200, 150), 'p.jpg')).body.id);
  const rs = await Promise.all([
    t.http().post(`/listings/${l.id}/photos`).set(owner.auth).send({ fileIds: ids.slice(0, 11) }),
    t.http().post(`/listings/${l.id}/photos`).set(owner.auth).send({ fileIds: ids.slice(11) }),
  ]);
  expect(rs.map((r) => r.status).sort()).toEqual([201, 400]);
  expect(await t.prisma.listingPhoto.count({ where: { listingId: l.id } })).toBe(11);
});

test('yeniden gönderilen ilanda moderatör önceki red gerekçesini görür', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await listing(owner.user.id, { status: 'pending', publishedAt: null });
  const m = await moderator();
  const version = (await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).updatedAt.toISOString();
  await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'blurry', version }).expect(200);
  await t.prisma.listingPhoto.create({ data: { listingId: l.id, fileId: 'x', order: 0 } });
  await t.http().post(`/listings/${l.id}/submit`).set(owner.auth).expect(200);
  const q = await t.http().get('/admin/queue?kind=listing').set(m.auth);
  expect(q.body.find((x: { id: string }) => x.id === l.id).previousRejectReason).toBe('blurry');
});
