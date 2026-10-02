import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { MemoryPushTransport, PUSH } from '../src/adapters/push';

let t: TestApp;
let push: MemoryPushTransport;
beforeAll(async () => { t = await createTestApp(); push = t.app.get(PUSH); });
afterAll(async () => { await t.close(); });

const draft = {
  brand: 'Push', model: 'Test', year: 2016, lengthM: 12.2, type: 'yelkenli', price: 100000, currency: 'EUR',
  location: 'Bodrum', equipment: [], cabins: 3, engine: '', description: '',
};
// Gerçek jetonlar ~22 karakter; sunucu 6'dan kısa gövdeyi reddeder.
const token = (s: string) => `ExponentPushToken[${s}-xxxx]`;
const settle = () => new Promise((r) => setTimeout(r, 80));

test('cihaz kaydı: jeton kullanıcıya bağlanır; fiyat düşünce telefona kendi dilinde bildirim gider', async () => {
  const owner = await loginAs(t, { level: 2 });
  const tr = await loginAs(t);
  const en = await loginAs(t);
  await t.http().patch('/me').set(en.auth).send({ lang: 'en' }).expect(200);
  expect((await t.http().put('/me/push-token').set(tr.auth).send({ token: token('tr-cihaz-1'), platform: 'android' })).status).toBe(204);
  expect((await t.http().put('/me/push-token').set(en.auth).send({ token: token('en-cihaz-1'), platform: 'ios' })).status).toBe(204);
  expect((await t.http().put('/me/push-token').set(en.auth).send({ token: 'bozuk', platform: 'ios' })).status).toBe(400);

  const l = await t.prisma.listing.create({ data: { ...draft, ownerId: owner.user.id, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] } });
  await t.http().put(`/favorites/${l.id}`).set(tr.auth).expect(204);
  await t.http().put(`/favorites/${l.id}`).set(en.auth).expect(204);
  await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 90000 }).expect(200);
  await settle();

  const toTr = push.sent.find((m) => m.to === token('tr-cihaz-1'));
  const toEn = push.sent.find((m) => m.to === token('en-cihaz-1'));
  expect(toTr).toMatchObject({ title: 'teknemisatıyorum', body: 'Favorindeki ilanın fiyatı düştü: Push Test', data: { key: 'notif.priceDrop', params: { listingId: l.id } } });
  expect(toEn?.body).toBe('A favourite dropped its price: Push Test');
});

test('aynı jeton başka hesaba taşınır; kapalı tercih ve kayıtsız cihaz bildirim almaz; çıkışta jeton silinir', async () => {
  const owner = await loginAs(t, { level: 2 });
  const a = await loginAs(t);
  const b = await loginAs(t);
  // Aynı telefon önce a, sonra b ile giriş yaptı: jeton artık b'nin.
  await t.http().put('/me/push-token').set(a.auth).send({ token: token('ortak'), platform: 'android' }).expect(204);
  await t.http().put('/me/push-token').set(b.auth).send({ token: token('ortak'), platform: 'android' }).expect(204);
  expect(await t.prisma.pushToken.count({ where: { token: token('ortak') } })).toBe(1);
  expect((await t.prisma.pushToken.findUnique({ where: { token: token('ortak') } }))!.userId).toBe(b.user.id);

  // a: tercihi kapalı; c: geçersiz (silinmiş uygulama) jeton.
  await t.http().put('/me/push-token').set(a.auth).send({ token: token('a-cihaz'), platform: 'ios' }).expect(204);
  await t.http().patch('/me').set(a.auth).send({ prefs: { notifyMatches: false } }).expect(200);
  const c = await loginAs(t);
  await t.http().put('/me/push-token').set(c.auth).send({ token: token('bad-cihaz'), platform: 'ios' }).expect(204);

  const l = await t.prisma.listing.create({ data: { ...draft, ownerId: owner.user.id, currency: 'EUR', type: 'yelkenli', status: 'published', publishedAt: new Date(), badges: [] } });
  for (const u of [a, b, c]) await t.http().put(`/favorites/${l.id}`).set(u.auth).expect(204);
  push.sent.length = 0;
  await t.http().patch(`/listings/${l.id}`).set(owner.auth).send({ price: 90000 }).expect(200);
  await settle();
  expect(push.sent.map((m) => m.to).sort()).toEqual([token('bad-cihaz'), token('ortak')]);
  expect(await t.prisma.pushToken.count({ where: { token: token('bad-cihaz') } })).toBe(0); // kayıtsız cihaz temizlendi

  await t.http().delete(`/me/push-token/${encodeURIComponent(token('ortak'))}`).set(b.auth).expect(204);
  expect(await t.prisma.pushToken.count({ where: { userId: b.user.id } })).toBe(0);
});
