import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

type Auth = Record<string, string>;
const moderator = () => loginAs(t, { level: 3, roles: ['moderator'] });
/** Hizmet veren: profil aç, belge başvurusu onaylansın → aktif. */
async function provider(kind: 'usta' | 'kaptan', body: Record<string, unknown>) {
  const u = await loginAs(t, { level: 2 });
  const r = await t.http().put(`/me/provider/${kind}`).set(u.auth).send({ displayName: kind === 'usta' ? 'Usta Ali' : 'Kaptan Ece', region: 'Bodrum', ...body });
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('pending');
  const v = await t.prisma.verificationRequest.create({ data: { userId: u.user.id, kind, fileIds: [] } });
  await t.http().post(`/admin/verifications/${v.id}/decision`).set((await moderator()).auth).send({ decision: 'approve' }).expect(200);
  return { ...u, profileId: r.body.id as string };
}
const devPay = (auth: Auth, paymentId: string) => t.http().post('/payments/web/dev-complete').set(auth).send({ orderId: paymentId, result: 'success' }).expect(200);

describe('usta işi: talep → teklif → kabul → emanet ödeme → tamam → karne → değerlendirme', () => {
  test('uçtan uca akış', async () => {
    const owner = await loginAs(t, { level: 2 });
    const boat = await t.prisma.boat.create({ data: { ownerId: owner.user.id, name: 'Mavi', brand: 'Bavaria', model: '41', year: 2016, lengthM: 12.4 } });
    const usta = await provider('usta', { categories: ['motor'] });
    expect((await t.http().get('/providers?kind=usta&category=motor')).body.some((p: { id: string }) => p.id === usta.profileId)).toBe(true);

    const job = (await t.http().post('/jobs').set(owner.auth).send({ category: 'motor', title: 'Motor su alıyor', description: 'Sintineye su geliyor, motor bölmesi ıslak.', boatId: boat.id })).body;
    expect(job.status).toBe('open');
    const inbox = (await t.http().get('/provider/jobs').set(usta.auth)).body;
    expect(inbox.open.map((j: { id: string }) => j.id)).toContain(job.id);
    const q = await t.http().post(`/jobs/${job.id}/quotes`).set(usta.auth).send({ priceTry: 12000, days: 2, note: 'Yarın bakarım' });
    expect(q.status).toBe(201);
    expect((await t.http().post(`/jobs/${job.id}/quotes`).set(owner.auth).send({ priceTry: 5000, days: 1 })).status).toBe(404);

    expect((await t.http().post(`/jobs/${job.id}/pay`).set(owner.auth).send({ accept: true })).body.code).toBe('JOB_NOT_ACCEPTED');
    await t.http().post(`/jobs/${job.id}/accept`).set(owner.auth).send({ quoteId: q.body.id }).expect(200);
    expect((await t.http().post(`/jobs/${job.id}/quotes`).set(usta.auth).send({ priceTry: 9000, days: 2 })).body.code).toBe('JOB_CLOSED');
    const pay = (await t.http().post(`/jobs/${job.id}/pay`).set(owner.auth).send({ accept: true })).body;
    expect(pay).toMatchObject({ amountKurus: 1200000, feeKurus: 96000 });
    expect(pay.checkoutUrl).toContain(`pay=${pay.paymentId}`);
    // Başkası ödemeyi tamamlayamaz.
    expect((await t.http().post('/payments/web/dev-complete').set(usta.auth).send({ orderId: pay.paymentId, result: 'success' })).status).toBe(404);
    await devPay(owner.auth, pay.paymentId);
    expect((await t.http().get(`/jobs/${job.id}`).set(owner.auth)).body).toMatchObject({ status: 'paid', paymentStatus: 'held' });
    expect((await t.http().post(`/jobs/${job.id}/pay`).set(owner.auth).send({ accept: true })).body.code).toBe('ALREADY_PAID');

    await t.http().post(`/jobs/${job.id}/complete`).set(owner.auth).expect(200);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: pay.paymentId } })).status).toBe('released');
    const entry = await t.prisma.logbookEntry.findFirst({ where: { boatId: boat.id, sourceRef: `job:${job.id}` } });
    expect(entry).toMatchObject({ kind: 'onarim', verified: true, title: 'Motor su alıyor', byName: 'Usta Ali' });

    await t.http().post(`/jobs/${job.id}/review`).set(owner.auth).send({ stars: 5, text: 'Hızlı ve temiz' }).expect(201);
    expect((await t.http().post(`/jobs/${job.id}/review`).set(owner.auth).send({ stars: 1 })).body.code).toBe('ALREADY_REVIEWED');
    expect((await t.http().get(`/providers/${usta.profileId}`)).body).toMatchObject({ rating: 5, reviewCount: 1 });
    expect((await t.http().get('/me/jobs').set(owner.auth)).body.find((j: { id: string }) => j.id === job.id)).toMatchObject({ status: 'done', reviewed: true, paymentStatus: 'released' });
    expect(await t.prisma.notification.count({ where: { userId: usta.user.id, key: 'notif.paymentReleased' } })).toBe(1);
  });

  test('onaysız usta listede görünmez ve teklif veremez; başkasının işini göremez', async () => {
    const owner = await loginAs(t, { level: 2 });
    const u = await loginAs(t, { level: 2 });
    const r = await t.http().put('/me/provider/usta').set(u.auth).send({ displayName: 'Bekleyen', region: 'Fethiye', categories: ['boya'] });
    expect((await t.http().get(`/providers/${r.body.id}`)).status).toBe(404);
    const job = (await t.http().post('/jobs').set(owner.auth).send({ category: 'boya', title: 'Zehirli boya', description: 'Karinaya zehirli boya yapılacak.' })).body;
    expect((await t.http().post(`/jobs/${job.id}/quotes`).set(u.auth).send({ priceTry: 5000, days: 1 })).status).toBe(404);
    expect((await t.http().get(`/jobs/${job.id}`).set((await loginAs(t)).auth)).status).toBe(404);
    expect((await t.http().post('/jobs').set(owner.auth).send({ category: 'boya', title: 'i18n:logbook.boatAdded', description: 'Taklit başlık denemesi uzun.' })).status).toBe(400);
  });
});

describe('kaptan rezervasyonu ve ekip iadesi', () => {
  test('rezervasyon → ödeme (kurla) → ekip iadesi; çakışan tarih alınamaz', async () => {
    const cap = await provider('kaptan', { dayRateEur: 300, weekRateEur: 1600, languages: ['tr', 'en'] });
    const guest = await loginAs(t, { level: 1 });
    const start = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
    const b = (await t.http().post('/captain-bookings').set(guest.auth).send({ providerId: cap.profileId, start, days: 7 })).body;
    expect(b).toMatchObject({ totalEur: 1600, status: 'requested' });
    const pay = (await t.http().post(`/captain-bookings/${b.id}/pay`).set(guest.auth).send({ accept: true })).body;
    const rate = (await t.http().get('/fx')).body.EUR;
    expect(pay.amountKurus).toBe(Math.round(1600 * rate * 100));
    await devPay(guest.auth, pay.paymentId);
    expect((await t.http().get('/provider/bookings').set(cap.auth)).body[0]).toMatchObject({ id: b.id, status: 'paid' });

    const other = await loginAs(t, { level: 1 });
    expect((await t.http().post('/captain-bookings').set(other.auth).send({ providerId: cap.profileId, start, days: 2 })).body.code).toBe('CAPTAIN_BUSY');
    expect((await t.http().post(`/captain-bookings/${b.id}/complete`).set(guest.auth)).body.code).toBe('BOOKING_NOT_STARTED');

    const m = await moderator();
    expect((await t.http().get('/admin/service-payments?status=held').set(m.auth)).body.some((p: { id: string }) => p.id === pay.paymentId)).toBe(true);
    // Para kararı yalnızca yöneticide.
    expect((await t.http().post(`/admin/service-payments/${pay.paymentId}/refund`).set(m.auth)).status).toBe(403);
    const admin = await loginAs(t, { level: 3, roles: ['admin'] });
    await t.http().post(`/admin/service-payments/${pay.paymentId}/refund`).set(admin.auth).expect(200);
    expect((await t.prisma.captainBooking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('cancelled');
    expect((await t.http().get('/me/service-payments').set(guest.auth)).body[0]).toMatchObject({ id: pay.paymentId, status: 'refunded' });
    expect((await t.http().get('/admin/service-payments').set(guest.auth)).status).toBe(403);
  });

  test('aynı tarihe iki ödeme: ikincisi emanete alınmaz, iade edilir; geri çevrilen talebin ödemesi de iade', async () => {
    const cap = await provider('kaptan', { dayRateEur: 200 });
    const start = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    const g1 = await loginAs(t, { level: 1 });
    const g2 = await loginAs(t, { level: 1 });
    const b1 = (await t.http().post('/captain-bookings').set(g1.auth).send({ providerId: cap.profileId, start, days: 2 })).body;
    const b2 = (await t.http().post('/captain-bookings').set(g2.auth).send({ providerId: cap.profileId, start, days: 2 })).body;
    const p1 = (await t.http().post(`/captain-bookings/${b1.id}/pay`).set(g1.auth).send({ accept: true })).body;
    const p2 = (await t.http().post(`/captain-bookings/${b2.id}/pay`).set(g2.auth).send({ accept: true })).body;
    await devPay(g1.auth, p1.paymentId);
    await devPay(g2.auth, p2.paymentId);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: p1.paymentId } })).status).toBe('held');
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: p2.paymentId } })).status).toBe('refunded');
    expect((await t.prisma.captainBooking.findUniqueOrThrow({ where: { id: b2.id } })).status).toBe('requested');
    expect(await t.prisma.notification.count({ where: { userId: g2.user.id, key: 'notif.paymentRefunded' } })).toBe(1);

    const g3 = await loginAs(t, { level: 1 });
    const later = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
    const b3 = (await t.http().post('/captain-bookings').set(g3.auth).send({ providerId: cap.profileId, start: later, days: 1 })).body;
    const p3 = (await t.http().post(`/captain-bookings/${b3.id}/pay`).set(g3.auth).send({ accept: true })).body;
    await t.http().post(`/captain-bookings/${b3.id}/decline`).set(cap.auth).expect(200);
    await devPay(g3.auth, p3.paymentId);
    const s3 = await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: p3.paymentId } });
    expect(s3).toMatchObject({ status: 'refunded', autoReleaseAt: null });
  });

  test('profil ve teklif üzerinden mesajlaşma açılır', async () => {
    const cap = await provider('kaptan', { dayRateEur: 250 });
    const guest = await loginAs(t, { level: 1 });
    const c = await t.http().post('/conversations').set(guest.auth).send({ subjectKind: 'provider', subjectId: cap.profileId });
    expect(c.status).toBe(201);
    expect((await t.http().post('/conversations').set(cap.auth).send({ subjectKind: 'provider', subjectId: cap.profileId })).body.code).toBe('OWN_PROFILE');
  });
});

describe('emanet: otomatik aktarım, itiraz, askı ve hesap silme', () => {
  async function paidJob(category = 'elektrik') {
    const owner = await loginAs(t, { level: 2 });
    const usta = await provider('usta', { categories: [category] });
    const job = (await t.http().post('/jobs').set(owner.auth).send({ category, title: 'Akü şarj etmiyor', description: 'Akü şarj olmuyor, alternatör kontrol.' })).body;
    const q = (await t.http().post(`/jobs/${job.id}/quotes`).set(usta.auth).send({ priceTry: 3000, days: 1 })).body;
    await t.http().post(`/jobs/${job.id}/accept`).set(owner.auth).send({ quoteId: q.id }).expect(200);
    const pay = (await t.http().post(`/jobs/${job.id}/pay`).set(owner.auth).send({ accept: true })).body;
    await devPay(owner.auth, pay.paymentId);
    return { owner, usta, job, pay };
  }
  const { EscrowSweeper } = require('../src/modules/marketplace/marketplace.module');
  const sweep = (daysAhead: number) => t.app.get(EscrowSweeper).sweep(new Date(Date.now() + daysAhead * 864e5));

  test('usta "işi bitirdim" der; sahibi onaylamazsa 7 gün sonra para kendiliğinden aktarılır', async () => {
    const { owner, usta, job, pay } = await paidJob();
    expect((await t.http().post(`/jobs/${job.id}/delivered`).set(owner.auth)).status).toBe(404);
    await t.http().post(`/jobs/${job.id}/delivered`).set(usta.auth).expect(200);
    const v = (await t.http().get(`/jobs/${job.id}`).set(owner.auth)).body;
    expect(v.deliveredAt).toBeTruthy();
    expect(new Date(v.autoReleaseAt).getTime()).toBeGreaterThan(Date.now() + 6 * 864e5);
    await sweep(3);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: pay.paymentId } })).status).toBe('held');
    await sweep(8);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: pay.paymentId } })).status).toBe('released');
    expect((await t.prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('done');
    expect(await t.prisma.notification.count({ where: { userId: owner.user.id, key: 'notif.autoReleased' } })).toBe(1);
  });

  test('ödeme sayfası açıkken iş iptal edilirse para emanete alınmaz; ekip kendi ödemesinde karar veremez', async () => {
    const owner = await loginAs(t, { level: 2 });
    const usta = await provider('usta', { categories: ['elektronik'] });
    const job = (await t.http().post('/jobs').set(owner.auth).send({ category: 'elektronik', title: 'Pompa arızası', description: 'Sintine pompası çalışmıyor, bakılacak.' })).body;
    const q = (await t.http().post(`/jobs/${job.id}/quotes`).set(usta.auth).send({ priceTry: 2000, days: 1 })).body;
    await t.http().post(`/jobs/${job.id}/accept`).set(owner.auth).send({ quoteId: q.id }).expect(200);
    const pay = (await t.http().post(`/jobs/${job.id}/pay`).set(owner.auth).send({ accept: true })).body;
    await t.http().post(`/jobs/${job.id}/cancel`).set(owner.auth).expect(200);
    await devPay(owner.auth, pay.paymentId);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: pay.paymentId } })).status).toBe('refunded');
    expect(await t.prisma.notification.count({ where: { userId: usta.user.id, key: 'notif.servicePaid' } })).toBe(0);

    const { pay: p2, usta: u2 } = await paidJob('motor');
    await t.prisma.user.update({ where: { id: u2.user.id }, data: { roles: ['admin'] } });
    expect((await t.http().post(`/admin/service-payments/${p2.paymentId}/release`).set(u2.auth)).body.code).toBe('SELF_DECISION');
    expect((await t.http().post(`/admin/service-payments/${p2.paymentId}/refund`).set(u2.auth)).body.code).toBe('SELF_DECISION');
  });

  test('sorun bildirilirse otomatik aktarım durur, ekip kuyruğunda en üstte görünür', async () => {
    const { owner, usta, job, pay } = await paidJob('yelken');
    await t.http().post(`/jobs/${job.id}/delivered`).set(usta.auth).expect(200);
    await t.http().post(`/jobs/${job.id}/dispute`).set(owner.auth).send({ note: 'Yelken hâlâ yırtık' }).expect(200);
    expect((await t.http().post(`/jobs/${job.id}/dispute`).set(owner.auth).send({ note: 'tekrar deneme' })).body.code).toBe('ALREADY_DISPUTED');
    await sweep(30);
    expect((await t.prisma.servicePayment.findUniqueOrThrow({ where: { id: pay.paymentId } })).status).toBe('held');
    const list = (await t.http().get('/admin/service-payments').set((await moderator()).auth)).body;
    expect(list[0]).toMatchObject({ id: pay.paymentId, disputeNote: 'Yelken hâlâ yırtık' });
  });

  test('askıya alınan usta listeden kalkar, ödenmemiş işteki teklifi düşer; askı kalkınca geri gelir', async () => {
    const owner = await loginAs(t, { level: 2 });
    const usta = await provider('usta', { categories: ['jelkot'] });
    const job = (await t.http().post('/jobs').set(owner.auth).send({ category: 'jelkot', title: 'Jelkot çatlağı', description: 'Baş tarafta jelkot çatlağı var.' })).body;
    const q = (await t.http().post(`/jobs/${job.id}/quotes`).set(usta.auth).send({ priceTry: 4000, days: 1 })).body;
    await t.http().post(`/jobs/${job.id}/accept`).set(owner.auth).send({ quoteId: q.id }).expect(200);
    const m = await moderator();
    await t.http().post(`/admin/users/${usta.user.id}/suspend`).set(m.auth).send({ reason: 'Dolandırıcılık' }).expect(200);
    expect((await t.http().get(`/providers/${usta.profileId}`)).status).toBe(404);
    expect((await t.http().get(`/jobs/${job.id}`).set(owner.auth)).body).toMatchObject({ status: 'open', acceptedQuoteId: null, quotes: [] });
    await t.http().post(`/admin/users/${usta.user.id}/unsuspend`).set(m.auth).expect(200);
    expect((await t.http().get(`/providers/${usta.profileId}`)).status).toBe(200);
  });

  test('hesap silinince profil bilgileri temizlenir; veri dökümünde işler ve ödemeler var', async () => {
    const { owner, usta } = await paidJob('doseme');
    const dump = (await t.http().get('/me/export').set(owner.auth)).body;
    expect(dump.jobs).toHaveLength(1);
    expect(dump.servicePayments[0]).toMatchObject({ subjectKind: 'job', status: 'held' });
    expect((await t.http().get('/me/export').set(usta.auth)).body.providers[0].quotes).toHaveLength(1);
    await t.http().delete('/me').set(usta.auth).expect(204);
    expect(await t.prisma.providerProfile.findUniqueOrThrow({ where: { id: usta.profileId } })).toMatchObject({ status: 'suspended', displayName: '—', bio: '' });
  });
});
