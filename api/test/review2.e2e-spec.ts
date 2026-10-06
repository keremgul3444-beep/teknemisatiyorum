// Son bağımsız incelemenin (arka uç 1. dalga) bulgularına karşı gerileme testleri.
import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';
import { DevSmsSender, SMS_SENDER } from '../src/adapters/sms';
import { resetEnvCache } from '../src/config/env';

let t: TestApp;
const sms = new DevSmsSender();
beforeAll(async () => { t = await createTestApp({ override: (b) => { b.overrideProvider(SMS_SENDER).useValue(sms); } }); });
afterAll(async () => { await t.close(); delete process.env.DEV_OTP_ECHO; process.env.NODE_ENV = 'test'; resetEnvCache(); });

const photo = async (auth: Record<string, string>, visibility: 'public' | 'private' = 'public') =>
  (await t.http().post('/media').set(auth).field('visibility', visibility).attach('file', await jpegWithExif(400, 300), 'p.jpg')).body.id as string;

test('I-2: eşzamanlı yanlış tahminler 5 deneme sınırını aşamaz', async () => {
  const phone = '05437770001';
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  const code = sms.inbox().filter((m) => m.phone === '+905437770001').at(-1)!.code;
  const wrong = code === '000000' ? '111111' : '000000';
  await Promise.all(Array.from({ length: 12 }, () => t.http().post('/auth/verify').send({ phone, code: wrong, deviceName: 'x' })));
  const row = await t.prisma.otpCode.findFirst({ where: { phone: '+905437770001' }, orderBy: { createdAt: 'desc' } });
  expect(row!.attempts).toBeLessThanOrEqual(5);
  const r = await t.http().post('/auth/verify').send({ phone, code, deviceName: 'x' });
  expect(r.body.code).toBe('OTP_LOCKED');
});

test('I-4: kod gösterme ayarı açıkken bile ekip (moderatör/yönetici) numarasına kod yanıtta dönmez', async () => {
  process.env.DEV_OTP_ECHO = '1';
  process.env.NODE_ENV = 'development';
  resetEnvCache();
  await t.prisma.user.create({ data: { phone: '+905437770099', roles: ['admin', 'moderator'], verifyLevel: 3 } });
  const staff = await t.http().post('/auth/otp').send({ phone: '05437770099' });
  expect(staff.status).toBe(204);
  expect(staff.body).toEqual({});
  const normal = await t.http().post('/auth/otp').send({ phone: '05437770098' });
  expect(normal.body.devCode).toMatch(/^\d{6}$/);
  delete process.env.DEV_OTP_ECHO;
  process.env.NODE_ENV = 'test';
  resetEnvCache();
});

test('I-5: moderatör bekleyen ilanı fotoğraflarıyla görür; kuyrukta fotoğraf bağlantıları var', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await t.http().post('/listings').set(owner.auth).send({ brand: 'Mod', model: 'Test', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' });
  const fid = await photo(owner.auth);
  await t.http().post(`/listings/${l.body.id}/photos`).set(owner.auth).send({ fileIds: [fid] });
  await t.http().post(`/listings/${l.body.id}/submit`).set(owner.auth).expect(200);
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const detail = await t.http().get(`/listings/${l.body.id}`).set(mod.auth);
  expect(detail.status).toBe(200);
  expect(detail.body.photos).toHaveLength(1);
  const q = await t.http().get('/admin/queue?kind=listing').set(mod.auth);
  expect(q.body.find((x: { id: string }) => x.id === l.body.id).photos[0]).toBe(`/media/${fid}`);
  // sıradan kullanıcı hâlâ göremez
  const other = await loginAs(t);
  expect((await t.http().get(`/listings/${l.body.id}`).set(other.auth)).status).toBe(404);
});

test('I-5: pasaport bilgileri başvuruda saklanır ve moderatöre gösterilir', async () => {
  const u = await loginAs(t);
  const fid = await photo(u.auth, 'private');
  await t.http().post('/verification/identity').set(u.auth)
    .send({ passport: 'U7654321', nationality: 'DE', firstName: 'Anna', lastName: 'Schmidt', birthYear: 1985, fileId: fid }).expect(200);
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const q = await t.http().get('/admin/queue?kind=verification').set(mod.auth);
  const item = q.body.find((x: { userId: string }) => x.userId === u.user.id);
  expect(item.details).toMatchObject({ passport: 'U7654321', nationality: 'DE', firstName: 'Anna', lastName: 'Schmidt', birthYear: 1985 });
});

test('I-6: yönetici tüm broker dosyalarını ve ekspertiz randevularını listeler', async () => {
  const u = await loginAs(t, { level: 2 });
  const c = await t.http().post('/broker/cases').set(u.auth).send({ boatName: 'Liste Test', askingPrice: 1000, currency: 'EUR' });
  const pkg = await t.prisma.expertisePackage.create({ data: { name: 'P', priceTry: 1, items: [], order: 9 } });
  const b = await t.http().post('/expertise/bookings').set(u.auth).send({ packageId: pkg.id, date: '2026-11-02', slot: 'noon' });
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const brokers = await t.http().get('/admin/broker').set(mod.auth);
  expect(brokers.body.map((x: { id: string }) => x.id)).toContain(c.body.id);
  const exp = await t.http().get('/admin/expertise').set(mod.auth);
  expect(exp.body.find((x: { id: string }) => x.id === b.body.id)).toMatchObject({ date: '2026-11-02', reportStatus: 'pending', packageName: 'P' });
  expect((await t.http().get('/admin/broker').set(u.auth)).status).toBe(403);
});

test('I-8: yayındaki ilana eklenen fotoğraf onay bekler; ilan yayında kalır', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await t.prisma.listing.create({ data: { ownerId: owner.user.id, brand: 'Foto', model: 'X', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Kaş', equipment: [], badges: [], status: 'published', publishedAt: new Date() } });
  const fid = await photo(owner.auth);
  const r = await t.http().post(`/listings/${l.id}/photos`).set(owner.auth).send({ fileIds: [fid] });
  expect(r.body).toMatchObject({ status: 'published', pendingEdit: true });
  expect(await t.prisma.listingPhoto.count({ where: { listingId: l.id } })).toBe(0);
});

test('I-8/minor: aynı dosya iki kez eklenmez', async () => {
  const owner = await loginAs(t, { level: 2 });
  const l = await t.http().post('/listings').set(owner.auth).send({ brand: 'Dup', model: 'X', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Kaş' });
  const fid = await photo(owner.auth);
  const r = await t.http().post(`/listings/${l.body.id}/photos`).set(owner.auth).send({ fileIds: [fid, fid] });
  expect(r.body.photos).toHaveLength(1);
});

test('I-9: hesap silinince korumalı belgeler de silinir', async () => {
  const u = await loginAs(t, { level: 2 });
  const fid = await photo(u.auth, 'private');
  await t.http().post('/verification/requests').set(u.auth).send({ kind: 'usta', fileIds: [fid] }).expect(201);
  await t.http().delete('/me').set(u.auth).expect(204);
  expect(await t.prisma.file.count({ where: { id: fid } })).toBe(0);
  const req = await t.prisma.verificationRequest.findFirst({ where: { userId: u.user.id } });
  expect(req!.fileIds).toEqual([]);
});

test('minor: geçersiz durum filtresi 400, 500 değil', async () => {
  const u = await loginAs(t);
  expect((await t.http().get('/me/listings?status=uydurma').set(u.auth)).status).toBe(400);
});

test('minor: sohbet en yeni mesajları döndürür (500 sınırında eskiler değil)', async () => {
  const s = await loginAs(t);
  const b = await loginAs(t);
  const l = await t.prisma.listing.create({ data: { ownerId: s.user.id, brand: 'Msg', model: 'X', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Kaş', equipment: [], badges: [], status: 'published', publishedAt: new Date() } });
  const c = await t.http().post('/conversations').set(b.auth).send({ subjectKind: 'listing', subjectId: l.id });
  await t.prisma.message.createMany({ data: Array.from({ length: 505 }, (_, i) => ({ conversationId: c.body.id, senderId: b.user.id, text: `m${i}`, createdAt: new Date(Date.now() + i) })) });
  const r = await t.http().get(`/conversations/${c.body.id}/messages`).set(s.auth);
  expect(r.body.messages.at(-1).text).toBe('m504');
  expect(r.body.messages[0].text).toBe('m5');
});
