// Son düzeltme turunun bağımsız incelemesindeki bulgulara karşı gerileme testleri.
import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs, randomTckn } from './helpers';
import { NotificationsService } from '../src/modules/notifications/notifications.module';
import { encrypt } from '../src/common/crypto';
import { backfillNationalIdHashes } from '../src/modules/verification/backfill';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const photo = async (auth: Record<string, string>, visibility: 'public' | 'private' = 'public') =>
  (await t.http().post('/media').set(auth).field('visibility', visibility).attach('file', await jpegWithExif(120, 80), 'p.jpg')).body.id as string;
const newListing = async (auth: Record<string, string>) =>
  (await t.http().post('/listings').set(auth).send({ brand: 'R4', model: 'T', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' })).body.id as string;

test('#1 aynı fotoğrafları yeniden göndermek sınırı aşmış sayılmaz', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await newListing(u.auth);
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) ids.push(await photo(u.auth));
  await t.http().post(`/listings/${id}/photos`).set(u.auth).send({ fileIds: ids }).expect(201);
  const again = await t.http().post(`/listings/${id}/photos`).set(u.auth).send({ fileIds: ids });
  expect(again.status).toBe(201);
  expect(again.body.photos).toHaveLength(12);
});

test('#3 hesap silinince pasaport bilgisi silinir, bekleyen başvuru geri çekilir, giriş kodları silinir', async () => {
  const u = await loginAs(t);
  const fid = await photo(u.auth, 'private');
  await t.http().post('/verification/identity').set(u.auth).send({ passport: 'X1234567', nationality: 'DE', firstName: 'A', lastName: 'B', birthYear: 1980, fileId: fid }).expect(200);
  await t.prisma.otpCode.create({ data: { phone: u.user.phone!, codeHash: 'x', expiresAt: new Date(Date.now() + 60_000) } });
  await t.http().delete('/me').set(u.auth).expect(204);
  const v = await t.prisma.verificationRequest.findFirst({ where: { userId: u.user.id } });
  expect(v!.details).toBeNull();
  expect(v!.status).toBe('rejected');
  expect(v!.rejectReason).toBe('withdrawn');
  expect(await t.prisma.otpCode.count({ where: { phone: u.user.phone! } })).toBe(0);
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const q = await t.http().get('/admin/queue?kind=verification').set(mod.auth);
  expect(q.body.find((x: { userId: string }) => x.userId === u.user.id)).toBeUndefined();
});

test('#3b silinen hesabın herkese açık fotoğrafları artık açılmaz', async () => {
  const u = await loginAs(t, { level: 2 });
  const fid = await photo(u.auth);
  expect((await t.http().get(`/media/${fid}`)).status).toBe(200);
  await t.http().delete('/me').set(u.auth).expect(204);
  expect((await t.http().get(`/media/${fid}`)).status).toBe(404);
});

test('#4 kapatılan bildirim türü gönderilmez; pazarlama bildirimi izinsiz açılamaz', async () => {
  const u = await loginAs(t);
  await t.http().patch('/me').set(u.auth).send({ prefs: { notifyMessages: false } }).expect(200);
  const svc = t.app.get(NotificationsService);
  await svc.push(u.user.id, 'notif.newMessage', { conversationId: 'c', title: 't' });
  await svc.push(u.user.id, 'notif.listingApproved', { title: 't', listingId: 'l' });
  const rows = await t.prisma.notification.findMany({ where: { userId: u.user.id } });
  expect(rows.map((r) => r.key)).toEqual(['notif.listingApproved']);
  const bad = await t.http().patch('/me').set(u.auth).send({ prefs: { notifyMarketing: true } });
  expect(bad.status).toBe(400);
  expect(bad.body.code).toBe('CONSENT_REQUIRED');
  await t.http().patch('/me').set(u.auth).send({ prefs: { marketingConsent: true, notifyMarketing: true } }).expect(200);
  // izin geri alınınca pazarlama bildirimi de kapanır
  const off = await t.http().patch('/me').set(u.auth).send({ prefs: { marketingConsent: false } });
  expect(off.body.prefs.notifyMarketing).toBe(false);
});

test('#5 kural öncesi doğrulanmış kullanıcıların kimlik izi sonradan doldurulur; çakışma raporlanır', async () => {
  const a = randomTckn();
  const u1 = await t.prisma.user.create({ data: { phone: '+905431110001', nationalIdEnc: encrypt(a), nationalIdLast2: a.slice(-2), verifyLevel: 2 } });
  const u2 = await t.prisma.user.create({ data: { phone: '+905431110002', nationalIdEnc: encrypt(a), nationalIdLast2: a.slice(-2), verifyLevel: 2 } });
  const r = await backfillNationalIdHashes(t.prisma);
  expect(r.filled).toBeGreaterThanOrEqual(1);
  expect(r.conflicts).toContainEqual(expect.objectContaining({ userId: expect.any(String) }));
  const rows = await t.prisma.user.findMany({ where: { id: { in: [u1.id, u2.id] } } });
  expect(rows.filter((x) => x.nationalIdHash).length).toBe(1);
  expect((await backfillNationalIdHashes(t.prisma)).filled).toBe(0);
});

test('ayarlar eşzamanlı değişince hiçbiri kaybolmaz', async () => {
  const u = await loginAs(t);
  await Promise.all([
    t.http().patch('/me').set(u.auth).send({ prefs: { notifyMessages: false } }),
    t.http().patch('/me').set(u.auth).send({ prefs: { notifyMatches: false } }),
    t.http().patch('/me').set(u.auth).send({ prefs: { phoneVisible: true } }),
  ]);
  const me = await t.http().get('/me').set(u.auth);
  expect(me.body.prefs).toMatchObject({ notifyMessages: false, notifyMatches: false, phoneVisible: true });
});

test('veri kopyası gelen mesajları ve izin geçmişini de içerir', async () => {
  const seller = await loginAs(t, { level: 2 });
  const id = await newListing(seller.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  const buyer = await loginAs(t);
  const c = await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: id });
  await t.http().post(`/conversations/${c.body.id}/messages`).set(buyer.auth).send({ text: 'gelen mesaj' });
  await t.http().patch('/me').set(seller.auth).send({ prefs: { marketingConsent: true } });
  const r = await t.http().get('/me/export').set(seller.auth);
  expect(JSON.stringify(r.body.conversations)).toContain('gelen mesaj');
  expect(r.body.consentHistory).toHaveLength(1);
});

test('#5 çözülemeyen (başka anahtarla şifrelenmiş) kayıt sunucuyu düşürmez, raporlanır', async () => {
  const u = await t.prisma.user.create({ data: { phone: '+905431110003', nationalIdEnc: 'bozuk.veri.xx', nationalIdLast2: '00' } });
  const r = await backfillNationalIdHashes(t.prisma);
  expect(r.unreadable).toContain(u.id);
});
