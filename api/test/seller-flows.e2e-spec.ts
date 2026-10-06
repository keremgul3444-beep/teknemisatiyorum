import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const base = {
  brand: 'Jeanneau', model: 'Sun Odyssey 410', year: 2020, lengthM: 12.4, type: 'yelkenli', price: 240000, currency: 'EUR' as const,
  location: 'Göcek', equipment: [], cabins: 3, engine: 'Yanmar', description: 'Temiz.', badges: [],
};
const moderator = () => loginAs(t, { level: 3, roles: ['moderator'] });
const versionOf = async (id: string) => (await t.prisma.listing.findUniqueOrThrow({ where: { id } })).updatedAt.toISOString();

describe('satıcı akışları', () => {
  test('red notu satıcıya görünür; reddedilen ilan düzenlenince reddedilmiş kalır, /submit ile onaya gider', async () => {
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'pending' } });
    const m = await moderator();
    await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'rules', note: 'Açıklamadaki telefon numarasını kaldır.', version: await versionOf(l.id) }).expect(200);
    const mine = (await t.http().get(`/listings/${l.id}`).set(s.auth)).body;
    expect(mine).toMatchObject({ status: 'rejected', rejectReason: 'rules', rejectNote: 'Açıklamadaki telefon numarasını kaldır.' });
    expect((await t.http().get(`/listings/${l.id}`).set((await loginAs(t)).auth)).status).toBe(404);

    await t.http().patch(`/listings/${l.id}`).set(s.auth).send({ description: 'Temiz, bakımlı.' }).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('rejected');
    const photo = await t.http().post('/media').set(s.auth).field('visibility', 'public').attach('file', await jpegWithExif(600, 400), 'p.jpg');
    await t.http().put(`/listings/${l.id}/photos`).set(s.auth).send({ fileIds: [photo.body.id] }).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('rejected');
    await t.http().post(`/listings/${l.id}/submit`).set(s.auth).expect(200);
    expect(await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ status: 'pending', rejectReason: null, rejectNote: null });
  });

  test('düzenleme sonrası yeniden onay ilk yayın tarihini ve süresini korur', async () => {
    const s = await loginAs(t, { level: 2 });
    const publishedAt = new Date(Date.now() - 20 * 864e5);
    const expiresAt = new Date(Date.now() + 70 * 864e5);
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt, expiresAt } });
    await t.http().patch(`/listings/${l.id}`).set(s.auth).send({ description: 'Yeni yelken.' }).expect(200);
    const m = await moderator();
    await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'approve', version: await versionOf(l.id) }).expect(200);
    const after = await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.status).toBe('published');
    expect(after.publishedAt?.getTime()).toBe(publishedAt.getTime());
    expect(after.expiresAt?.getTime()).toBe(expiresAt.getTime());
  });

  test('yayındaki ilanın düzenlemesi ayrı bekler: ilan yayında kalır, retle düzenleme atılır, onayla uygulanır', async () => {
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date(), expiresAt: new Date(Date.now() + 60 * 864e5) } });
    const r = await t.http().patch(`/listings/${l.id}`).set(s.auth).send({ description: 'Tel: 0532 000 00 00', cabins: 4 });
    expect(r.body).toMatchObject({ status: 'published', pendingEdit: true, description: 'Tel: 0532 000 00 00', cabins: 4 });
    const pub = (await t.http().get(`/listings/${l.id}`)).body;
    expect(pub).toMatchObject({ description: 'Temiz.', cabins: 3 });
    expect(pub.pendingEdit).toBeUndefined();
    const m = await moderator();
    const q = (await t.http().get('/admin/queue').set(m.auth)).body.find((x: { id: string }) => x.id === l.id);
    expect(q).toMatchObject({ liveEdit: true, description: 'Tel: 0532 000 00 00' });
    expect(q.changed.sort()).toEqual(['cabins', 'description']);
    await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'rules', note: 'Telefon yazılmaz.', version: q.version }).expect(200);
    const after = (await t.http().get(`/listings/${l.id}`).set(s.auth)).body;
    expect(after).toMatchObject({ status: 'published', pendingEdit: false, description: 'Temiz.', rejectReason: 'rules', rejectNote: 'Telefon yazılmaz.' });
    expect(await t.prisma.notification.count({ where: { userId: s.user.id, key: 'notif.editRejected' } })).toBe(1);

    await t.http().patch(`/listings/${l.id}`).set(s.auth).send({ cabins: 4 }).expect(200);
    await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'approve', version: await versionOf(l.id) }).expect(200);
    expect((await t.http().get(`/listings/${l.id}`)).body).toMatchObject({ cabins: 4, description: 'Temiz.' });
    expect(await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ pendingAt: null, rejectReason: null });
    expect(await t.prisma.notification.count({ where: { userId: s.user.id, key: 'notif.editApproved' } })).toBe(1);
  });

  test('süresi dolan ilan yenilenince kalan vitrin süresi yayında olmadığı gün kadar uzar', async () => {
    const s = await loginAs(t, { level: 2 });
    const expiredAt = new Date(Date.now() - 5 * 864e5);
    const featuredUntil = new Date(Date.now() + 2 * 864e5);
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'expired', publishedAt: new Date(Date.now() - 95 * 864e5), expiresAt: expiredAt, featuredUntil } });
    await t.http().post(`/listings/${l.id}/renew`).set(s.auth).expect(200);
    const after = await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.status).toBe('published');
    expect(after.featuredUntil!.getTime() - featuredUntil.getTime()).toBeGreaterThan(5 * 864e5 - 60_000);
  });

  test('süresi dolmuş ilan satıldı işaretlenebilir; taslak/kaldırılmış işaretlenemez', async () => {
    const s = await loginAs(t, { level: 1 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'expired' } });
    await t.http().post(`/listings/${l.id}/sold`).set(s.auth).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('sold');
    // Geri alınabilir: yayın süresi bitmiş ilan "süresi doldu"ya döner.
    await t.http().post(`/listings/${l.id}/unsold`).set(s.auth).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('expired');
    const live = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) } });
    await t.http().post(`/listings/${live.id}/sold`).set(s.auth).expect(200);
    await t.http().post(`/listings/${live.id}/unsold`).set(s.auth).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: live.id } })).status).toBe('published');
    await t.http().post(`/listings/${live.id}/sold`).set(s.auth).expect(200);
    await t.prisma.auditLog.updateMany({ where: { action: 'audit.listingSold', targetId: live.id }, data: { at: new Date(Date.now() - 8 * 864e5) } });
    expect((await t.http().post(`/listings/${live.id}/unsold`).set(s.auth)).body.code).toBe('UNSOLD_WINDOW');
    const d = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'draft' } });
    expect((await t.http().post(`/listings/${d.id}/sold`).set(s.auth)).status).toBe(409);
  });

  test('ruhsat ilansız yüklenemez; bekleyen başvuru varken ikincisi açılmaz; red gerekçesi ve notu görünür', async () => {
    const s = await loginAs(t, { level: 2 });
    const l = await t.prisma.listing.create({ data: { ...base, ownerId: s.user.id, status: 'published', publishedAt: new Date() } });
    const f = await t.http().post('/media').set(s.auth).field('visibility', 'private').attach('file', await jpegWithExif(300, 200), 'r.jpg');
    expect((await t.http().post('/verification/requests').set(s.auth).send({ kind: 'ruhsat', fileIds: [f.body.id] })).body.code).toBe('LISTING_REQUIRED');
    const r = await t.http().post('/verification/requests').set(s.auth).send({ kind: 'ruhsat', fileIds: [f.body.id], listingId: l.id });
    expect(r.status).toBe(201);
    expect((await t.http().post('/verification/requests').set(s.auth).send({ kind: 'ruhsat', fileIds: [f.body.id], listingId: l.id })).body.code).toBe('REQUEST_PENDING');
    const m = await moderator();
    await t.http().post(`/admin/verifications/${r.body.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'blurry', note: 'Ruhsatın tamamı görünmüyor.' }).expect(200);
    const mine = (await t.http().get('/verification/requests/mine').set(s.auth)).body;
    expect(mine[0]).toMatchObject({ kind: 'ruhsat', status: 'rejected', listingId: l.id, rejectReason: 'blurry', rejectNote: 'Ruhsatın tamamı görünmüyor.' });
    // Reddedildikten sonra yeniden yüklenebilir.
    expect((await t.http().post('/verification/requests').set(s.auth).send({ kind: 'ruhsat', fileIds: [f.body.id], listingId: l.id })).status).toBe(201);
  });
});
