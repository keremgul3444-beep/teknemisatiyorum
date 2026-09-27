import { createTestApp, type TestApp } from './setup';
import { seedProducts } from '../prisma/seed';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

test('ürünler mevcut veritabanına da eklenir; tekrar çalışınca yönetici fiyatı ezilmez', async () => {
  await seedProducts(t.prisma);
  expect(await t.prisma.product.count()).toBe(5);
  await t.prisma.product.update({ where: { code: 'vitrin_7' }, data: { priceWebKurus: 99900, isTrialPrice: false } });
  await seedProducts(t.prisma);
  expect(await t.prisma.product.count()).toBe(5);
  expect(await t.prisma.product.findUnique({ where: { code: 'vitrin_7' } })).toMatchObject({ priceWebKurus: 99900, isTrialPrice: false });
});
