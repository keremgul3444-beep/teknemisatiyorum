import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';
import { runSeed } from '../prisma/seed';
import { DevSmsSender } from '../src/adapters/sms';
import { resetEnvCache } from '../src/config/env';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const pendingListing = (ownerId: string, extra: object = {}) => t.prisma.listing.create({
  data: { ownerId, brand: 'Hanse', model: '418', year: 2021, lengthM: 12.4, type: 'yelkenli', price: 265000, currency: 'EUR', location: 'Çeşme', equipment: [], badges: [], status: 'pending', ...extra },
});
const moderator = () => loginAs(t, { level: 3, roles: ['moderator'] });

describe('ekspertiz', () => {
  test('paketler herkese açık; randevu gün olarak saklanır', async () => {
    await t.prisma.expertisePackage.create({ data: { name: 'Temel', priceTry: 12500, items: ['Gövde'], order: 1 } });
    const pk = await t.http().get('/expertise/packages');
    expect(pk.status).toBe(200);
    const a = await loginAs(t);
    const r = await t.http().post('/expertise/bookings').set(a.auth).send({ packageId: pk.body[0].id, date: '2026-10-01', slot: 'morning' });
    expect(r.status).toBe(201);
    expect(r.body.date).toBe('2026-10-01');
    expect((await t.http().get('/me/expertise').set(a.auth)).body[0].date).toBe('2026-10-01');
  });

  test('rapor tamamlanınca ilana "ekspertizli" rozeti ve bağlı teknenin karnesine doğrulanmış kayıt', async () => {
    const owner = await loginAs(t, { level: 2 });
    const boat = await t.prisma.boat.create({ data: { ownerId: owner.user.id, name: 'B', brand: 'x', model: 'y', year: 2019, lengthM: 10 } });
    const l = await pendingListing(owner.user.id, { status: 'published', boatId: boat.id });
    const pkg = await t.prisma.expertisePackage.create({ data: { name: 'Kapsamlı', priceTry: 24000, items: [], order: 2 } });
    const b = await t.http().post('/expertise/bookings').set(owner.auth).send({ packageId: pkg.id, listingId: l.id, date: '2026-10-02', slot: 'noon' });
    const m = await moderator();
    const r = await t.http().post(`/admin/expertise/${b.body.id}/report`).set(m.auth).send({ score: 82 });
    expect(r.status).toBe(200);
    expect((await t.prisma.listing.findUnique({ where: { id: l.id } }))!.badges).toContain('ekspertizli');
    const entries = await t.prisma.logbookEntry.findMany({ where: { boatId: boat.id } });
    expect(entries.some((e) => e.kind === 'ekspertiz' && e.verified)).toBe(true);
  });
});

describe('broker', () => {
  test('seviye 2 başvurur; adım 4ten sonra ilerlemez ve kayıt yazılmaz', async () => {
    const a = await loginAs(t, { level: 2 });
    const c = await t.http().post('/broker/cases').set(a.auth).send({ boatName: 'Deniz Kızı', askingPrice: 98000, currency: 'EUR' });
    expect(c.status).toBe(201);
    const m = await moderator();
    for (let i = 0; i < 4; i++) expect((await t.http().post(`/admin/broker/${c.body.id}/advance`).set(m.auth)).status).toBe(200);
    const before = await t.prisma.auditLog.count();
    const r = await t.http().post(`/admin/broker/${c.body.id}/advance`).set(m.auth);
    expect(r.status).toBe(409);
    expect(await t.prisma.auditLog.count()).toBe(before);
    expect((await t.http().get(`/broker/cases/${c.body.id}`).set(a.auth)).body.step).toBe(4);
  });

  test('seviye 1 başvuramaz; başkasının dosyası okunamaz', async () => {
    const a = await loginAs(t, { level: 1 });
    expect((await t.http().post('/broker/cases').set(a.auth).send({ boatName: 'x', askingPrice: 1, currency: 'EUR' })).status).toBe(403);
    const b = await loginAs(t, { level: 2 });
    const c = await t.http().post('/broker/cases').set(b.auth).send({ boatName: 'y', askingPrice: 1, currency: 'EUR' });
    expect((await t.http().get(`/broker/cases/${c.body.id}`).set(a.auth)).status).toBe(404);
  });
});

describe('yönetim', () => {
  test('moderatör olmayan karar veremez', async () => {
    const owner = await loginAs(t);
    const l = await pendingListing(owner.user.id);
    const x = await loginAs(t, { level: 3 });
    expect((await t.http().post(`/admin/listings/${l.id}/decision`).set(x.auth).send({ decision: 'approve' })).status).toBe(403);
  });

  test('onay: yayında + sahibine bildirim + işlem kaydı; ikinci karar 409', async () => {
    const owner = await loginAs(t);
    const l = await pendingListing(owner.user.id);
    const m = await moderator();
    const q = await t.http().get('/admin/queue?kind=listing').set(m.auth);
    expect(q.body.map((x: { id: string }) => x.id)).toContain(l.id);
    const r = await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'approve' });
    expect(r.status).toBe(200);
    const row = await t.prisma.listing.findUnique({ where: { id: l.id } });
    expect(row).toMatchObject({ status: 'published' });
    expect(row!.publishedAt).toBeTruthy();
    expect(await t.prisma.notification.count({ where: { userId: owner.user.id, key: 'notif.listingApproved' } })).toBe(1);
    expect(await t.prisma.auditLog.count({ where: { action: 'audit.listingApproved', targetId: l.id } })).toBe(1);
    const again = await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'rules' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_DECIDED');
  });

  test('red gerekçe ister', async () => {
    const owner = await loginAs(t);
    const l = await pendingListing(owner.user.id);
    const m = await moderator();
    expect((await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject' })).status).toBe(400);
    expect((await t.http().post(`/admin/listings/${l.id}/decision`).set(m.auth).send({ decision: 'reject', reason: 'rules' })).status).toBe(200);
    expect((await t.prisma.listing.findUnique({ where: { id: l.id } }))!).toMatchObject({ status: 'rejected', rejectReason: 'rules' });
  });

  test('ruhsat onayı ilana sahiplik rozeti; usta belgesi onayı seviye 3', async () => {
    const owner = await loginAs(t, { level: 2 });
    const l = await pendingListing(owner.user.id, { status: 'published' });
    const f = await t.http().post('/media').set(owner.auth).field('visibility', 'private').attach('file', await jpegWithExif(300, 200), 'r.jpg');
    const vr = await t.http().post('/verification/requests').set(owner.auth).send({ kind: 'ruhsat', fileIds: [f.body.id], listingId: l.id });
    const f2 = await t.http().post('/media').set(owner.auth).field('visibility', 'private').attach('file', await jpegWithExif(300, 200), 'u.jpg');
    const vr2 = await t.http().post('/verification/requests').set(owner.auth).send({ kind: 'usta', fileIds: [f2.body.id] });
    const m = await moderator();
    expect((await t.http().post(`/admin/verifications/${vr.body.id}/decision`).set(m.auth).send({ decision: 'approve' })).status).toBe(200);
    expect((await t.prisma.listing.findUnique({ where: { id: l.id } }))!.badges).toContain('sahiplik');
    await t.http().post(`/admin/verifications/${vr2.body.id}/decision`).set(m.auth).send({ decision: 'approve' }).expect(200);
    expect((await t.prisma.user.findUnique({ where: { id: owner.user.id } }))!.verifyLevel).toBe(3);
    // moderatör belgeyi imzalı bağlantıyla açabilir
    expect((await t.http().get(`/media/${f.body.id}/signed`).set(m.auth)).status).toBe(200);
  });

  test('kullanıcı listesi maskeli', async () => {
    const u = await loginAs(t);
    const m = await moderator();
    const r = await t.http().get('/admin/users').set(m.auth);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(u.user.phone!);
    expect(r.body.find((x: { id: string }) => x.id === u.user.id).phone).toMatch(/^\+90 5•• ••• •• \d\d$/);
  });

  test('genel bakış ve işlem kaydı', async () => {
    const m = await moderator();
    const o = await t.http().get('/admin/overview').set(m.auth);
    expect(o.body).toHaveProperty('pendingListings');
    expect((await t.http().get('/admin/audit').set(m.auth)).status).toBe(200);
  });

  test('geliştirme kod kutusu yalnızca yöneticiye ve üretim dışında', async () => {
    t.app.get(DevSmsSender).sendOtp('+905551112233', '123456');
    const admin = await loginAs(t, { level: 3, roles: ['admin'] });
    const r = await t.http().get('/admin/dev/otp-inbox').set(admin.auth);
    expect(r.body.at(-1)).toMatchObject({ phone: '+905551112233', code: '123456' });
    expect((await t.http().get('/admin/dev/otp-inbox').set((await moderator()).auth)).status).toBe(403);
    process.env.NODE_ENV = 'production';
    resetEnvCache();
    expect((await t.http().get('/admin/dev/otp-inbox').set(admin.auth)).status).toBe(404);
    process.env.NODE_ENV = 'test';
    resetEnvCache();
  });
});

describe('başlangıç verisi', () => {
  test('25 yayında ilan (fotoğraflı), paketler, kurlar ve yönetici', async () => {
    await t.prisma.listing.deleteMany({});
    await runSeed(t.prisma);
    expect(await t.prisma.listing.count({ where: { status: 'published' } })).toBe(25);
    expect(await t.prisma.listingPhoto.count()).toBeGreaterThanOrEqual(25);
    expect(await t.prisma.expertisePackage.count()).toBeGreaterThanOrEqual(3);
    expect(await t.prisma.fxRate.count()).toBe(3);
    expect(await t.prisma.user.count({ where: { roles: { has: 'admin' } } })).toBeGreaterThanOrEqual(1);
  });
});
