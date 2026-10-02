import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { SMS_SENDER, DevSmsSender } from '../src/adapters/sms';

let t: TestApp;
let sms: DevSmsSender;
beforeAll(async () => {
  sms = new DevSmsSender();
  t = await createTestApp({ override: (b) => { b.overrideProvider(SMS_SENDER).useValue(sms); } });
});
afterAll(async () => { await t.close(); });

const base = {
  brand: 'Jeanneau', model: 'Sun Odyssey 349', year: 2019, lengthM: 10.3, type: 'yelkenli', price: 120000, currency: 'EUR' as const,
  location: 'Göcek', equipment: [], badges: [], cabins: 2, engine: '', description: '',
};
const listing = (ownerId: string, status: 'published' | 'pending' = 'published') =>
  t.prisma.listing.create({ data: { ...base, ownerId, status, publishedAt: status === 'published' ? new Date() : null } });
const moderator = () => loginAs(t, { level: 3, roles: ['moderator'] });

describe('ilan bildirme', () => {
  test('giriş yapmış alıcı bir kez bildirir; misafir, sahibi ve yayında olmayan ilan bildiremez', async () => {
    const owner = await loginAs(t, { level: 2 });
    const buyer = await loginAs(t);
    const l = await listing(owner.user.id);
    const pending = await listing(owner.user.id, 'pending');
    expect((await t.http().post(`/listings/${l.id}/report`).send({ reason: 'scam' })).status).toBe(401);
    const r = await t.http().post(`/listings/${l.id}/report`).set(buyer.auth).send({ reason: 'scam', note: 'Kapora için IBAN istedi' });
    expect(r.status).toBe(201);
    const again = await t.http().post(`/listings/${l.id}/report`).set(buyer.auth).send({ reason: 'other' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_REPORTED');
    const own = await t.http().post(`/listings/${l.id}/report`).set(owner.auth).send({ reason: 'scam' });
    expect(own.body.code).toBe('OWN_LISTING');
    expect((await t.http().post(`/listings/${pending.id}/report`).set(buyer.auth).send({ reason: 'scam' })).status).toBe(404);
    expect((await t.http().post(`/listings/${l.id}/report`).set((await loginAs(t)).auth).send({ reason: 'hosuma-gitmedi' })).status).toBe(400);
    // Bildirim ilanı kendiliğinden kaldırmaz.
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('published');
  });

  test('kişi başına günlük bildirim sınırı', async () => {
    const owner = await loginAs(t, { level: 2 });
    const buyer = await loginAs(t);
    const ls = await Promise.all(Array.from({ length: 11 }, () => listing(owner.user.id)));
    for (const l of ls.slice(0, 10)) expect((await t.http().post(`/listings/${l.id}/report`).set(buyer.auth).send({ reason: 'wrong_info' })).status).toBe(201);
    const over = await t.http().post(`/listings/${ls[10].id}/report`).set(buyer.auth).send({ reason: 'wrong_info' });
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('REPORT_LIMIT');
  });
});

describe('moderatör: bildirimler, kaldırma, yoksayma', () => {
  test('kuyruk ilana göre gruplanır, en çok bildirilen önce; ekip dışı göremez', async () => {
    const owner = await loginAs(t, { level: 2 });
    const a = await listing(owner.user.id);
    const b = await listing(owner.user.id);
    for (let i = 0; i < 3; i++) await t.http().post(`/listings/${b.id}/report`).set((await loginAs(t)).auth).send({ reason: 'scam' }).expect(201);
    await t.http().post(`/listings/${a.id}/report`).set((await loginAs(t)).auth).send({ reason: 'sold' }).expect(201);
    const m = await moderator();
    const q = await t.http().get('/admin/reports').set(m.auth);
    expect(q.status).toBe(200);
    const mine = q.body.filter((g: { listing: { id: string } }) => [a.id, b.id].includes(g.listing.id));
    expect(mine.map((g: { listing: { id: string }; count: number }) => [g.listing.id, g.count])).toEqual([[b.id, 3], [a.id, 1]]);
    expect(JSON.stringify(q.body)).not.toContain('+90');
    expect((await t.http().get('/admin/reports').set((await loginAs(t, { level: 3 })).auth)).status).toBe(403);
  });

  test('kaldırma: ilan herkese kapanır, sahibine gerekçesiyle görünür ve bildirim gider; bildirimler kapanır', async () => {
    const owner = await loginAs(t, { level: 2 });
    const l = await listing(owner.user.id);
    await t.http().post(`/listings/${l.id}/report`).set((await loginAs(t)).auth).send({ reason: 'scam' }).expect(201);
    const m = await moderator();
    const r = await t.http().post(`/admin/listings/${l.id}/takedown`).set(m.auth).send({ reason: 'scam' });
    expect(r.status).toBe(200);
    expect((await t.http().get(`/listings/${l.id}`)).status).toBe(404);
    const mine = (await t.http().get('/me/listings').set(owner.auth)).body.find((x: { id: string }) => x.id === l.id);
    expect(mine).toMatchObject({ status: 'removed', removedReason: 'scam' });
    expect(await t.prisma.notification.count({ where: { userId: owner.user.id, key: 'notif.listingRemoved' } })).toBe(1);
    expect(await t.prisma.listingReport.count({ where: { listingId: l.id, status: 'actioned' } })).toBe(1);
    expect(await t.prisma.auditLog.count({ where: { action: 'audit.listingRemoved', targetId: l.id } })).toBe(1);
    const again = await t.http().post(`/admin/listings/${l.id}/takedown`).set(m.auth).send({ reason: 'scam' });
    expect(again.body.code).toBe('LISTING_CLOSED');
  });

  test('sahibinin kendi kaldırdığı ilan İlanlarım\'da görünmez; moderatör kendi ilanını kaldıramaz', async () => {
    const owner = await loginAs(t, { level: 2 });
    const l = await listing(owner.user.id);
    await t.http().delete(`/listings/${l.id}`).set(owner.auth).expect(204);
    expect((await t.http().get('/me/listings').set(owner.auth)).body.some((x: { id: string }) => x.id === l.id)).toBe(false);
    const m = await moderator();
    const own = await listing(m.user.id);
    expect((await t.http().post(`/admin/listings/${own.id}/takedown`).set(m.auth).send({ reason: 'rules' })).body.code).toBe('SELF_DECISION');
  });

  test('yoksayma: ilan yayında kalır, bildirimler kapanır', async () => {
    const owner = await loginAs(t, { level: 2 });
    const l = await listing(owner.user.id);
    await t.http().post(`/listings/${l.id}/report`).set((await loginAs(t)).auth).send({ reason: 'other' }).expect(201);
    const m = await moderator();
    expect((await t.http().post(`/admin/listings/${l.id}/reports/dismiss`).set(m.auth)).body).toEqual({ dismissed: 1 });
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('published');
    expect((await t.http().get('/admin/reports').set(m.auth)).body.some((g: { listing: { id: string } }) => g.listing.id === l.id)).toBe(false);
  });
});

describe('hesap askıya alma', () => {
  test('oturumlar kapanır, ilanlar kalkar, yeniden giriş engellenir; askı kaldırılınca giriş açılır', async () => {
    const seller = await loginAs(t, { level: 2 });
    const live = await listing(seller.user.id);
    const pend = await listing(seller.user.id, 'pending');
    await t.http().post(`/listings/${live.id}/report`).set((await loginAs(t)).auth).send({ reason: 'scam' }).expect(201);
    const m = await moderator();
    const r = await t.http().post(`/admin/users/${seller.user.id}/suspend`).set(m.auth).send({ reason: 'Dolandırıcılık bildirimleri' });
    expect(r.body).toEqual({ suspended: true, removedListings: 2 });
    expect((await t.http().get('/me/listings').set(seller.auth)).status).toBe(401);
    for (const id of [live.id, pend.id]) {
      expect(await t.prisma.listing.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'removed', removedReason: 'account_suspended' });
    }
    expect(await t.prisma.listingReport.count({ where: { listingId: live.id, status: 'open' } })).toBe(0);

    await t.http().post('/auth/otp').send({ phone: seller.user.phone }).expect(204);
    const code = sms.inbox().filter((x) => x.phone === seller.user.phone).at(-1)!.code;
    const blocked = await t.http().post('/auth/verify').send({ phone: seller.user.phone, code, deviceName: 'x' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_SUSPENDED');

    expect((await t.http().post(`/admin/users/${seller.user.id}/suspend`).set(m.auth).send({ reason: 'yine' })).body.code).toBe('ALREADY_SUSPENDED');
    await t.http().post(`/admin/users/${seller.user.id}/unsuspend`).set(m.auth).expect(200);
    // Askı kalkınca aynı hesap yeni oturumla yeniden kullanılabilir.
    const s = await t.prisma.session.create({ data: { userId: seller.user.id, familyId: crypto.randomUUID(), deviceName: 'yeni', refreshHash: crypto.randomBytes(16).toString('hex') } });
    const token = await t.app.get(JwtService).signAsync({ sub: seller.user.id, sid: s.id });
    expect((await t.http().get('/me/listings').set({ Authorization: `Bearer ${token}` })).status).toBe(200);
    // Askı kaldırılınca ilanlar kendiliğinden geri gelmez.
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: live.id } })).status).toBe('removed');
    expect(await t.prisma.auditLog.count({ where: { action: 'audit.userSuspended', targetId: seller.user.id } })).toBe(1);
  });

  test('ekip üyesi ve kişinin kendisi askıya alınamaz', async () => {
    const m = await moderator();
    const other = await moderator();
    expect((await t.http().post(`/admin/users/${other.user.id}/suspend`).set(m.auth).send({ reason: 'deneme' })).body.code).toBe('STAFF_PROTECTED');
    expect((await t.http().post(`/admin/users/${m.user.id}/suspend`).set(m.auth).send({ reason: 'deneme' })).body.code).toBe('SELF_DECISION');
  });
});
