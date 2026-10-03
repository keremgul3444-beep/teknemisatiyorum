import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { DevWebPayment } from '../src/adapters/payments';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
  for (const p of [
    { code: 'vitrin_7', kind: 'vitrin', days: 7 }, { code: 'acil_7', kind: 'acil', days: 7 }, { code: 'ust_tasi', kind: 'bump', days: null },
  ] as const) await t.prisma.product.create({ data: { ...p, priceWebKurus: 4900, priceAppKurus: 5900, iosProductId: `tms.${p.code}`, androidProductId: `tms_${p.code}` } });
});
afterAll(async () => { await t.close(); });

const DAY = 864e5;
async function published(auth: Record<string, string>) {
  const r = await t.http().post('/listings').set(auth).send({ brand: 'Pay', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date() } });
  return r.body.id as string;
}
const callback = (body: { rawBody: string; signature: string }) =>
  t.http().post('/payments/web/callback').set('Content-Type', 'application/json').set('X-Signature', body.signature).send(body.rawBody);
const sim = (providerRef: string, orderId: string, result: 'success' | 'failure', amountKurus: number) =>
  new DevWebPayment().simulate({ providerRef, orderId, result, amountKurus });

test('ürün listesi herkese açık, site ve uygulama fiyatıyla', async () => {
  const r = await t.http().get('/products');
  expect(r.body.find((p: { code: string }) => p.code === 'vitrin_7')).toMatchObject({ kind: 'vitrin', days: 7, priceWebKurus: 4900, priceAppKurus: 5900 });
});

test('sipariş → imzalı başarılı bildirim → vitrin 7 gün açılır', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  expect(o.status).toBe(201);
  expect(o.body.checkoutUrl).toContain(`/odeme/deneme?order=${o.body.orderId}`);
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  expect(row).toMatchObject({ status: 'pending', amountKurus: 4900, channel: 'web' });
  expect((await callback(sim(row.providerRef!, row.id, 'success', 4900))).status).toBe(200);
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
  expect(l.featuredUntil!.getTime()).toBeGreaterThan(Date.now() + 6.9 * DAY);
  expect((await t.http().get('/me/orders').set(u.auth)).body[0]).toMatchObject({ status: 'paid', productCode: 'vitrin_7' });
});

test('aynı bildirim eşzamanlı iki kez gelirse süre bir kez eklenir', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'acil_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  const s = sim(row.providerRef!, row.id, 'success', 4900);
  const rs = await Promise.all([callback(s), callback(s), callback(s)]);
  // Sağlayıcı 200 dışı yanıtı tekrar gönderir: tekrar gelen bildirim de başarıyla karşılanmalı.
  expect(rs.map((r) => r.status)).toEqual([200, 200, 200]);
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
  expect(l.urgentUntil!.getTime()).toBeLessThan(Date.now() + 7.1 * DAY);
});

test('imzasız, yanlış imzalı ya da tutarı farklı bildirim siparişi değiştirmez', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  const good = sim(row.providerRef!, row.id, 'success', 4900);
  expect((await t.http().post('/payments/web/callback').set('Content-Type', 'application/json').send(good.rawBody)).status).toBe(400);
  expect((await callback({ rawBody: good.rawBody, signature: 'a'.repeat(64) })).status).toBe(400);
  expect((await callback(sim(row.providerRef!, row.id, 'success', 1))).status).toBe(409);
  expect((await t.prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('pending');
});

test('başarısız ödeme ürünü açmaz; yayında olmayan ya da başkasının ilanına sipariş verilemez', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  await callback(sim(row.providerRef!, row.id, 'failure', 4900));
  expect((await t.prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('failed');
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil).toBeNull();
  await t.prisma.listing.update({ where: { id }, data: { status: 'sold' } });
  const sold = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  expect(sold.status).toBe(409);
  expect(sold.body.code).toBe('LISTING_NOT_PUBLISHED');
  const other = await loginAs(t, { level: 2 });
  const theirs = await published(other.auth);
  expect((await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: theirs, productCode: 'vitrin_7' })).status).toBe(404);
  expect((await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: theirs, productCode: 'yok' })).status).toBe(404);
});

test('sipariş yalnızca sahibine görünür; 24 saatten eski bekleyen iptal görünür', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  const other = await loginAs(t);
  expect((await t.http().get(`/orders/${o.body.orderId}`).set(other.auth)).status).toBe(404);
  await t.prisma.order.update({ where: { id: o.body.orderId }, data: { createdAt: new Date(Date.now() - 25 * 3600e3) } });
  expect((await t.http().get(`/orders/${o.body.orderId}`).set(u.auth)).body.status).toBe('cancelled');
});

test('deneme tamamlama: yalnızca sipariş sahibi; ürün açılır', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'ust_tasi' });
  const other = await loginAs(t);
  expect((await t.http().post('/payments/web/dev-complete').set(other.auth).send({ orderId: o.body.orderId, result: 'success' })).status).toBe(404);
  expect((await t.http().post('/payments/web/dev-complete').set(u.auth).send({ orderId: o.body.orderId, result: 'success' })).status).toBe(200);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).bumpedAt).toBeTruthy();
});

test('mağaza makbuzu: doğrulanır, ürün açılır; aynı makbuz ikinci kez kullanılamaz', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const receipt = `dev:tms.acil_7:${Date.now()}abc`;
  const r = await t.http().post('/orders/store').set(u.auth).send({ accept: true, listingId: id, platform: 'ios', receipt });
  expect(r.status).toBe(201);
  expect(r.body.status).toBe('paid');
  const o = await t.prisma.order.findUniqueOrThrow({ where: { id: r.body.orderId } });
  expect(o).toMatchObject({ channel: 'ios', amountKurus: 5900, productCode: 'acil_7' });
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).urgentUntil).toBeTruthy();
  const again = await t.http().post('/orders/store').set(u.auth).send({ accept: true, listingId: id, platform: 'ios', receipt });
  expect(again.status).toBe(409);
  expect(again.body.code).toBe('RECEIPT_USED');
  expect((await t.http().post('/orders/store').set(u.auth).send({ accept: true, listingId: id, platform: 'android', receipt: 'dev:bilinmeyen:abcdef' })).status).toBe(400);
  const other = await loginAs(t, { level: 2 });
  expect((await t.http().post('/orders/store').set(other.auth).send({ accept: true, listingId: id, platform: 'ios', receipt: `dev:tms.acil_7:${Date.now()}zzz` })).status).toBe(404);
});

test('başarısız bildirimden sonra gelen geçerli başarılı bildirim ürünü açar (para çekildiyse ürün verilir)', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const o = await t.http().post('/orders').set(u.auth).send({ accept: true, listingId: id, productCode: 'vitrin_7' });
  const row = await t.prisma.order.findUniqueOrThrow({ where: { id: o.body.orderId } });
  await callback(sim(row.providerRef!, row.id, 'failure', 4900));
  expect((await callback(sim(row.providerRef!, row.id, 'success', 4900))).status).toBe(200);
  expect((await t.prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('paid');
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil).toBeTruthy();
});

test('ön bilgilendirme onayı olmadan ödeme başlamaz; onay sürümüyle işlem kaydına ve veri kopyasına yazılır', async () => {
  const u = await loginAs(t, { level: 2 });
  const id = await published(u.auth);
  const no = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7' });
  expect(no.status).toBe(400);
  expect(no.body.code).toBe('PREINFO_REQUIRED');
  expect(await t.prisma.order.count({ where: { userId: u.user.id } })).toBe(0);
  const o = await t.http().post('/orders').set(u.auth).send({ listingId: id, productCode: 'vitrin_7', accept: true });
  const log = await t.prisma.auditLog.findFirst({ where: { actorId: u.user.id, action: 'audit.preinfoAccepted' } });
  expect(log).toMatchObject({ targetType: 'order', targetId: o.body.orderId, params: { version: expect.any(String) } });
  const exp = await t.http().get('/me/export').set(u.auth);
  expect(JSON.stringify(exp.body)).toContain('audit.preinfoAccepted');
});
