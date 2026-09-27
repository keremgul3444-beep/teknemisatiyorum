import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
  await t.prisma.product.create({ data: { code: 'vitrin_30', kind: 'vitrin', days: 30, priceWebKurus: 100, priceAppKurus: 100 } });
});
afterAll(async () => { await t.close(); });

async function published(auth: Record<string, string>) {
  const r = await t.http().post('/listings').set(auth).send({ brand: 'Adm', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' });
  await t.prisma.listing.update({ where: { id: r.body.id }, data: { status: 'published', publishedAt: new Date() } });
  return r.body.id as string;
}

test('yönetici havale siparişi oluşturur, iade eder; süre geri çekilir; kayıt düşer', async () => {
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const seller = await loginAs(t, { level: 2 });
  const id = await published(seller.auth);
  const noNote = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: id, productCode: 'vitrin_30' });
  expect(noNote.status).toBe(400);
  const r = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: id, productCode: 'vitrin_30', note: 'Dekont 12345' });
  expect(r.status).toBe(201);
  const until = (await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil!;
  expect(until.getTime()).toBeGreaterThan(Date.now() + 29 * 864e5);
  const list = await t.http().get('/admin/orders').set(admin.auth);
  expect(list.body.find((o: { id: string }) => o.id === r.body.orderId)).toMatchObject({ channel: 'manual', status: 'paid', note: 'Dekont 12345' });
  expect((await t.http().post(`/admin/orders/${r.body.orderId}/refund`).set(admin.auth)).status).toBe(204);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id } })).featuredUntil!.getTime()).toBeLessThan(Date.now() + 864e5);
  expect((await t.http().post(`/admin/orders/${r.body.orderId}/refund`).set(admin.auth)).status).toBe(409);
  expect(await t.prisma.auditLog.count({ where: { targetId: r.body.orderId } })).toBeGreaterThanOrEqual(3);
});

test('moderatör yapamaz; yönetici kendi ilanına yapamaz; yayında olmayan ilana yapılamaz', async () => {
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const own = await published(admin.auth);
  expect((await t.http().get('/admin/orders').set(mod.auth)).status).toBe(403);
  expect((await t.http().put('/admin/products/vitrin_30').set(mod.auth).send({ priceWebKurus: 200 })).status).toBe(403);
  const self = await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: own, productCode: 'vitrin_30', note: 'kendim' });
  expect(self.status).toBe(403);
  expect(self.body.code).toBe('SELF_DECISION');
  const seller = await loginAs(t, { level: 2 });
  const sold = await published(seller.auth);
  await t.prisma.listing.update({ where: { id: sold }, data: { status: 'sold' } });
  expect((await t.http().post('/admin/orders/manual').set(admin.auth).send({ listingId: sold, productCode: 'vitrin_30', note: 'satıldı' })).status).toBe(409);
});

test('fiyat değişikliği deneme işaretini kaldırır ve kayda düşer; bilinmeyen ürün 404', async () => {
  const admin = await loginAs(t, { level: 3, roles: ['admin'] });
  const r = await t.http().put('/admin/products/vitrin_30').set(admin.auth).send({ priceWebKurus: 149900, priceAppKurus: 179900 });
  expect(r.body).toMatchObject({ priceWebKurus: 149900, priceAppKurus: 179900, isTrialPrice: false });
  expect(await t.prisma.auditLog.count({ where: { action: 'audit.productPriceChanged', targetId: 'vitrin_30' } })).toBe(1);
  expect((await t.http().put('/admin/products/yok').set(admin.auth).send({ priceWebKurus: 1000 })).status).toBe(404);
});
