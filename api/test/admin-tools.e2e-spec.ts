import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const base = {
  brand: 'Hanse', model: '418', year: 2021, lengthM: 12.4, type: 'yelkenli', price: 265000, currency: 'EUR' as const,
  location: 'Bodrum', equipment: [], cabins: 3, engine: 'Volvo', description: 'Bakımlı.', badges: [],
};
const mod = () => loginAs(t, { level: 3, roles: ['moderator'] });
const admin = () => loginAs(t, { level: 3, roles: ['admin'] });

describe('yönetici araçları', () => {
  test('kullanıcı arama (telefon, ad) ve ayrıntı', async () => {
    const m = await mod();
    const u = await loginAs(t, { name: 'Zeynep Arama' });
    await t.prisma.listing.create({ data: { ...base, ownerId: u.user.id, status: 'published', publishedAt: new Date() } });
    const local = `0${u.user.phone!.slice(3)}`;
    expect((await t.http().get(`/admin/users?q=${encodeURIComponent(local)}`).set(m.auth)).body.map((x: { id: string }) => x.id)).toEqual([u.user.id]);
    expect((await t.http().get('/admin/users?q=zeynep ara').set(m.auth)).body.some((x: { id: string }) => x.id === u.user.id)).toBe(true);
    const d = (await t.http().get(`/admin/users/${u.user.id}`).set(m.auth)).body;
    expect(d).toMatchObject({ name: 'Zeynep Arama', reports: { filed: 0, received: 0 } });
    expect(d.listings).toHaveLength(1);
    expect(d.phone).not.toBe(u.user.phone);
    expect((await t.http().get(`/admin/users/${u.user.id}`).set(u.auth)).status).toBe(403);
  });

  test('roller yalnızca yöneticide; kendi rolünü değiştiremez, son yönetici düşmez', async () => {
    const a = await admin();
    const m = await mod();
    const u = await loginAs(t);
    expect((await t.http().post(`/admin/users/${u.user.id}/roles`).set(m.auth).send({ roles: ['moderator'] })).status).toBe(403);
    await t.http().post(`/admin/users/${u.user.id}/roles`).set(a.auth).send({ roles: ['moderator'] }).expect(200);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.user.id } })).roles).toEqual(['user', 'moderator']);
    expect((await t.http().post(`/admin/users/${a.user.id}/roles`).set(a.auth).send({ roles: [] })).body.code).toBe('SELF_DECISION');
    expect(await t.prisma.auditLog.count({ where: { action: 'audit.rolesChanged', targetId: u.user.id, actorId: a.user.id } })).toBe(1);
  });

  test('kaldırılan ilan geri alınır; askı kalkınca askı yüzünden kaldırılanlar onaya döner', async () => {
    const m = await mod();
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date() } });
    await t.http().post(`/admin/listings/${l.id}/takedown`).set(m.auth).send({ reason: 'wrong_info' }).expect(200);
    await t.http().post(`/admin/listings/${l.id}/restore`).set(m.auth).expect(200);
    expect(await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ status: 'pending', removedReason: null });

    const own = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'removed' } });
    expect((await t.http().post(`/admin/listings/${own.id}/restore`).set(m.auth)).body.code).toBe('NOT_RESTORABLE');

    const l2 = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date() } });
    await t.http().post(`/admin/users/${s.user.id}/suspend`).set(m.auth).send({ reason: 'Deneme askısı' }).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l2.id } })).status).toBe('removed');
    expect((await t.http().post(`/admin/listings/${l2.id}/restore`).set(m.auth)).body.code).toBe('OWNER_SUSPENDED');
    expect((await t.http().post(`/admin/users/${s.user.id}/unsuspend`).set(m.auth).expect(200)).body.restoredListings).toBeGreaterThanOrEqual(1);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l2.id } })).status).toBe('pending');
  });

  test('yorum gizlenir, puan ortalamasından düşer; hizmet profili durdurulur', async () => {
    const m = await mod();
    const p = await loginAs(t, { level: 3 });
    const prof = await t.prisma.providerProfile.create({ data: { userId: p.user.id, kind: 'usta', status: 'active', displayName: 'Usta Test', region: 'Bodrum', categories: ['motor'], ratingSum: 6, ratingCount: 2 } });
    const author = await loginAs(t);
    const r = await t.prisma.review.create({ data: { providerId: prof.id, authorId: author.user.id, subjectKind: 'job', subjectId: `j-${prof.id}`, stars: 1, text: 'Hakaret' } });
    await t.http().post(`/admin/reviews/${r.id}/hide`).set(m.auth).expect(200);
    expect(await t.prisma.providerProfile.findUniqueOrThrow({ where: { id: prof.id } })).toMatchObject({ ratingSum: 5, ratingCount: 1 });
    expect((await t.http().get(`/providers/${prof.id}`)).body.reviews?.some((x: { id: string }) => x.id === r.id) ?? false).toBe(false);
    expect((await t.http().post(`/admin/reviews/${r.id}/hide`).set(m.auth)).body.code).toBe('ALREADY_DONE');
    await t.http().post(`/admin/reviews/${r.id}/show`).set(m.auth).expect(200);
    expect((await t.prisma.providerProfile.findUniqueOrThrow({ where: { id: prof.id } })).ratingCount).toBe(2);

    await t.http().post(`/admin/providers/${prof.id}/status`).set(m.auth).send({ status: 'suspended' }).expect(200);
    expect((await t.http().get(`/providers/${prof.id}`)).status).toBe(404);
    expect(await t.prisma.notification.count({ where: { userId: p.user.id, key: 'notif.providerSuspended' } })).toBe(1);
  });

  test('işlem kaydı süzülür, yapanın adı gelir; genel bakışta kuyruk yaşı; ekip yeni şikâyetten haberdar olur', async () => {
    const m = await loginAs(t, { level: 3, roles: ['moderator'], name: 'Mod Ayşe' });
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date() } });
    await t.http().post(`/admin/listings/${l.id}/takedown`).set(m.auth).send({ reason: 'scam' }).expect(200);
    const rows = (await t.http().get(`/admin/audit?actor=${m.user.id}`).set(m.auth)).body;
    expect(rows[0]).toMatchObject({ action: 'audit.listingRemoved', actorName: 'Mod Ayşe', targetId: l.id });
    expect((await t.http().get(`/admin/audit?target=${l.id}&action=listingRemoved`).set(m.auth)).body).toHaveLength(1);
    const o = (await t.http().get('/admin/overview').set(m.auth)).body;
    expect(o).toHaveProperty('openDisputes');
    expect(o).toHaveProperty('oldestHours.listing');

    const l2 = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date() } });
    const buyer = await loginAs(t);
    await t.http().post(`/listings/${l2.id}/report`).set(buyer.auth).send({ reason: 'scam' }).expect(201);
    expect(await t.prisma.notification.count({ where: { userId: m.user.id, key: 'notif.staffReport' } })).toBe(1);
    await t.http().post(`/listings/${l2.id}/report`).set((await loginAs(t)).auth).send({ reason: 'other' }).expect(201);
    expect(await t.prisma.notification.count({ where: { userId: m.user.id, key: 'notif.staffReport' } })).toBe(1);
  });

  test('kuyruk firmaya ve türe göre süzülür; firma ilanları toplu onaylanır', async () => {
    const m = await mod();
    const s = await loginAs(t, { level: 2 });
    const c = (await t.http().post('/companies').set(s.auth).send({ name: 'Toplu Yat', kind: 'galeri', city: 'Bodrum' })).body;
    const a = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, companyId: c.id, status: 'pending' } });
    const b = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, companyId: c.id, status: 'pending' } });
    const q = (await t.http().get(`/admin/queue?kind=listing&company=${c.id}&scope=new`).set(m.auth)).body;
    expect(q.map((x: { id: string }) => x.id).sort()).toEqual([a.id, b.id].sort());
    expect(q[0].company).toMatchObject({ id: c.id, name: 'Toplu Yat' });
    expect((await t.http().get(`/admin/queue?kind=listing&company=${c.id}&scope=edit`).set(m.auth)).body).toHaveLength(0);
    const items = q.map((x: { id: string; version: string }) => ({ id: x.id, version: x.version }));
    items.push({ id: a.id, version: 'eski' });
    const r = (await t.http().post('/admin/listings/bulk-approve').set(m.auth).send({ items })).body;
    expect(r.approved).toBe(2);
    expect(r.results.filter((x: { ok: boolean }) => !x.ok)).toHaveLength(1);
    expect(await t.prisma.listing.count({ where: { id: { in: [a.id, b.id] }, status: 'published' } })).toBe(2);
  });

  test('ekip yazma işlemleri kişi başı dakikada 60 ile sınırlı; okuma etkilenmez', async () => {
    const m = await mod();
    for (let i = 0; i < 60; i++) expect((await t.http().post('/admin/listings/yokilan0001/reports/dismiss').set(m.auth)).status).toBe(404);
    expect((await t.http().post('/admin/listings/yokilan0001/reports/dismiss').set(m.auth)).body.code).toBe('STAFF_RATE');
    expect((await t.http().get('/admin/overview').set(m.auth)).status).toBe(200);
    expect((await t.http().post('/admin/listings/yokilan0001/reports/dismiss').set((await mod()).auth)).status).toBe(404);
  });

  test('düzenlenen ilan kuyrukta değişen alanlarıyla gelir', async () => {
    const m = await mod();
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'pending' } });
    const q1 = (await t.http().get('/admin/queue').set(m.auth)).body.find((x: { id: string }) => x.id === l.id);
    expect(q1.changed).toBeNull();
    await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'approve', version: q1.version }).expect(200);
    await t.http().patch(`/listings/${l.id}`).set(s.auth).send({ description: 'Yeni açıklama', cabins: 4 }).expect(200);
    const q2 = (await t.http().get('/admin/queue').set(m.auth)).body.find((x: { id: string }) => x.id === l.id);
    expect(q2.changed.sort()).toEqual(['cabins', 'description']);
  });
});
