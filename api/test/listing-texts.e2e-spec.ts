import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { resetEnvCache } from '../src/config/env';
import { LISTING_WRITER, type ListingFacts } from '../src/adapters/listing-writer';
import { DESCRIBE_PER_DAY, ListingTexts } from '../src/modules/listings/listing-writer.service';

let t: TestApp;
const seen: ListingFacts[] = [];
let fail = false;
beforeAll(async () => {
  t = await createTestApp({
    override: (b) => b.overrideProvider(LISTING_WRITER).useValue({
      describe: async (f: ListingFacts) => { if (fail) throw new Error('kapalı'); seen.push(f); return `Model taslağı: ${f.brand} ${f.model}`; },
      translate: async (s: string) => `EN: ${s}`,
    }),
  });
});
afterAll(async () => { await t.close(); delete process.env.ANTHROPIC_API_KEY; resetEnvCache(); });
const withKey = (on: boolean) => { process.env.ANTHROPIC_API_KEY = on ? 'test-key' : ''; resetEnvCache(); };
const facts = { brand: 'Bavaria', model: 'Cruiser 41', year: 2016, lengthM: 12.4, type: 'yelkenli', location: 'Bodrum', engine: 'Volvo D2-40', engineHours: 850, equipment: ['jenerator', 'otopilot'], negotiable: true, notes: 'Tek sahibinden' };

test('anahtar yoksa kural tabanlı taslak: yalnızca girilen bilgiler, uydurma yok', async () => {
  withKey(false);
  const u = await loginAs(t);
  const r = await t.http().post('/listings/describe').set(u.auth).send(facts);
  expect(r.status).toBe(200);
  expect(r.body.source).toBe('rules');
  expect(r.body.text).toBe("2016 model Bavaria Cruiser 41, 12,4 metre yelkenli. Tekne Bodrum'da. Volvo D2-40 motorlu, motor 850 saatte. Donanım: jeneratör, otopilot. Pazarlık payı var. Tek sahibinden");
});

test('anahtar varsa model taslağı; model hata verirse ve günlük sınır aşılınca kural tabanlı', async () => {
  withKey(true);
  t.app.get(ListingTexts).resetUsage();
  const u = await loginAs(t);
  const r = await t.http().post('/listings/describe').set(u.auth).send(facts);
  expect(r.body).toEqual({ text: 'Model taslağı: Bavaria Cruiser 41', source: 'llm' });
  expect(seen.at(-1)).toMatchObject({ notes: 'Tek sahibinden', equipment: ['jenerator', 'otopilot'] });
  fail = true;
  expect((await t.http().post('/listings/describe').set(u.auth).send(facts)).body.source).toBe('rules');
  fail = false;
  for (let i = 0; i < DESCRIBE_PER_DAY; i++) await t.http().post('/listings/describe').set(u.auth).send(facts);
  expect((await t.http().post('/listings/describe').set(u.auth).send(facts)).body.source).toBe('rules');
  expect((await t.http().post('/listings/describe').send(facts)).status).toBe(401);
  expect((await t.http().post('/listings/describe').set(u.auth).send({ ...facts, type: 'denizalti' })).status).toBe(400);
});

test('onaylanan ilanın İngilizce açıklaması üretilir; açıklama değişince silinir', async () => {
  withKey(true);
  const seller = await loginAs(t, { level: 2 });
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const l = await t.prisma.listing.create({
    data: { ownerId: seller.user.id, brand: 'Bavaria', model: 'C41', year: 2016, lengthM: 12.4, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum', status: 'pending', description: 'Bakımlı tekne.' },
  });
  await t.http().post(`/admin/listings/${l.id}/decision`).set(mod.auth).send({ decision: 'approve', version: l.updatedAt.toISOString() }).expect(200);
  await new Promise((ok) => setTimeout(ok, 300));
  expect((await t.http().get(`/listings/${l.id}`)).body.descriptionEn).toBe('EN: Bakımlı tekne.');
  await t.http().patch(`/listings/${l.id}`).set(seller.auth).send({ description: 'Yeni boya yapıldı.' }).expect(200);
  expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).descriptionEn).toBeNull();
});
