import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { LEADS_PER_DAY } from '../src/modules/leads/leads.module';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const base = { brand: 'Bavaria', model: 'C41', year: 2016, lengthM: 12, type: 'yelkenli', price: 1, currency: 'EUR' as const, location: 'Bodrum' };

test('video bağlantısı tek biçimde saklanır; bilinmeyen site reddedilir; boş bırakılınca kalkar', async () => {
  const u = await loginAs(t, { level: 2 });
  const r = await t.http().post('/listings').set(u.auth).send({ ...base, videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=3' });
  expect(r.status).toBe(201);
  expect(r.body.videoUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  expect((await t.http().post('/listings').set(u.auth).send({ ...base, videoUrl: 'https://kotu.site/v.mp4' })).status).toBe(400);
  const p = await t.http().patch(`/listings/${r.body.id}`).set(u.auth).send({ videoUrl: null });
  expect(p.body.videoUrl).toBeNull();
});

test('teklif talebi: açık izin zorunlu; ad ve telefon hesaptan; günlük sınır; ekip görür ve işler; hesap silinince silinir', async () => {
  const seller = await loginAs(t, { level: 2 });
  const l = await t.prisma.listing.create({ data: { ...base, ownerId: seller.user.id, status: 'published', publishedAt: new Date() } });
  const u = await loginAs(t, { name: 'Ayşe K.' });
  expect((await t.http().post('/leads').set(u.auth).send({ kind: 'finance', listingId: l.id })).status).toBe(400);
  const r = await t.http().post('/leads').set(u.auth).send({ kind: 'finance', listingId: l.id, note: '%30 peşinat', consent: true });
  expect(r.status).toBe(201);
  expect(await t.prisma.leadRequest.findUniqueOrThrow({ where: { id: r.body.id } })).toMatchObject({ name: 'Ayşe K.', phone: u.user.phone, kind: 'finance', note: '%30 peşinat' });
  for (let i = 1; i < LEADS_PER_DAY; i++) await t.http().post('/leads').set(u.auth).send({ kind: 'insurance', consent: true }).expect(201);
  expect((await t.http().post('/leads').set(u.auth).send({ kind: 'transport', consent: true })).status).toBe(429);

  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  expect((await t.http().get('/admin/leads').set(u.auth)).status).toBe(403);
  const list = (await t.http().get('/admin/leads?status=new').set(mod.auth)).body as { id: string; listing: { brand: string } | null; phone?: string; phoneMasked: string }[];
  const mine = list.find((x) => x.id === r.body.id)!;
  expect(mine.listing?.brand).toBe('Bavaria');
  // Listede numara maskeli; tam numara "göster" ile açılır ve kayda geçer.
  expect(mine.phone).toBeUndefined();
  expect(mine.phoneMasked).not.toBe(u.user.phone);
  expect((await t.http().post(`/admin/leads/${r.body.id}/reveal`).set(mod.auth).expect(200)).body.phone).toBe(u.user.phone);
  expect(await t.prisma.auditLog.count({ where: { action: 'audit.leadRevealed', targetId: r.body.id, actorId: mod.user.id } })).toBe(1);
  await t.http().post(`/admin/leads/${r.body.id}/status`).set(mod.auth).send({ status: 'forwarded' }).expect(200);
  expect((await t.http().get('/admin/leads?status=forwarded').set(mod.auth)).body.some((x: { id: string }) => x.id === r.body.id)).toBe(true);

  const exp = await t.http().get('/me/export').set(u.auth);
  expect(JSON.stringify(exp.body)).toContain('%30 peşinat');
  await t.http().delete('/me').set(u.auth).expect(204);
  expect(await t.prisma.leadRequest.count({ where: { userId: u.user.id } })).toBe(0);
});
