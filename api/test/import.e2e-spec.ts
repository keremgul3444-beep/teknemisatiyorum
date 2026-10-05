import sharp from 'sharp';
import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { IMAGE_FETCHER, ImageFetchError } from '../src/adapters/image-fetch';
import { ImportRunner } from '../src/modules/companies/import/import.service';

let t: TestApp;
const fetched: string[] = [];
beforeAll(async () => {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 20, g: 90, b: 140 } } }).jpeg().toBuffer();
  t = await createTestApp({
    override: (b) => b.overrideProvider(IMAGE_FETCHER).useValue(async (url: string) => {
      fetched.push(url);
      if (url.includes('kirik')) throw new ImageFetchError('status');
      return jpeg;
    }),
  });
});
afterAll(async () => { await t.close(); });

const HEADER = 'marka;model;yil;boy_m;tip;fiyat;para;konum;donanim;aciklama;fotograflar';
const row = (model: string, photos: string, extra = '') => `Bavaria;${model};2016;12,4;Yelkenli;145.000;EUR;Bodrum;Jeneratör;Temiz${extra};${photos}`;

async function firm() {
  const owner = await loginAs(t, { level: 2 });
  const c = await t.http().post('/companies').set(owner.auth).send({ name: 'Mavi Galeri', kind: 'galeri', city: 'Bodrum' });
  return { owner, companyId: c.body.id as string };
}

test('önizleme hiçbir şey oluşturmaz; geçerli satırları ve satır hatalarını (Excel satır numarasıyla) söyler', async () => {
  const { owner, companyId } = await firm();
  const csv = [HEADER, row('C41', 'https://galeri.com/1.jpg'), 'Bavaria;;20x;12;Denizaltı;1;EUR;Bodrum;;;http://x.com/a.jpg'].join('\n');
  const r = await t.http().post(`/companies/${companyId}/imports/preview`).set(owner.auth).send({ csv });
  expect(r.status).toBe(201);
  expect(r.body.valid).toBe(1);
  expect(r.body.errors.map((e: { row: number; field: string }) => `${e.row}:${e.field}`)).toEqual(['3:model', '3:year', '3:type', '3:photos']);
  expect(await t.prisma.listing.count({ where: { companyId } })).toBe(0);
  const bad = await t.http().post(`/companies/${companyId}/imports/preview`).set(owner.auth).send({ csv: 'marka;model\nA;B' });
  expect(bad.body.missing).toEqual(['year', 'lengthM', 'type', 'price', 'location', 'photos']);
});

test('yükleme arka planda: fotoğraflar indirilir, ilanlar firma adına onaya gider; kırık fotoğraflı satır raporlanır', async () => {
  const { owner, companyId } = await firm();
  const csv = [HEADER, row('C41', 'https://galeri.com/1.jpg | https://galeri.com/2.jpg'), row('C45', 'https://galeri.com/kirik.jpg'), 'X;;;;;;;;;;'].join('\r\n');
  const r = await t.http().post(`/companies/${companyId}/imports`).set(owner.auth).send({ csv });
  expect(r.status).toBe(201);
  await t.app.get(ImportRunner).idle();
  const job = (await t.http().get(`/companies/${companyId}/imports/${r.body.id}`).set(owner.auth)).body;
  expect(job).toMatchObject({ status: 'done', total: 3, created: 1, processed: 3 });
  expect(job.failed.map((f: { row: number; error: string }) => `${f.row}:${f.error}`)).toEqual(['3:photo:status', expect.stringMatching(/^4:/)]);
  const listings = await t.prisma.listing.findMany({ where: { companyId }, include: { photos: true } });
  expect(listings).toHaveLength(1);
  expect(listings[0]).toMatchObject({ model: 'C41', status: 'pending', ownerId: owner.user.id, lengthM: 12.4, price: 145000, equipment: ['jenerator'] });
  expect(listings[0].photos).toHaveLength(2);
  expect(fetched).toEqual(expect.arrayContaining(['https://galeri.com/1.jpg', 'https://galeri.com/2.jpg']));
  // Moderasyon kuyruğunda görünür.
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const q = await t.http().get('/admin/queue').set(mod.auth);
  expect(JSON.stringify(q.body)).toContain(listings[0].id);
});

test('yalnızca firma üyesi; kimliği doğrulanmamış üye yükleyemez; büyük dosya (100 KB üstü) kabul edilir; aynı anda tek iş', async () => {
  const { owner, companyId } = await firm();
  const stranger = await loginAs(t, { level: 2 });
  expect((await t.http().post(`/companies/${companyId}/imports/preview`).set(stranger.auth).send({ csv: HEADER })).status).toBe(404);
  const weak = await loginAs(t, { level: 1 });
  expect((await t.http().post(`/companies/${companyId}/imports/preview`).set(weak.auth).send({ csv: HEADER })).status).toBe(403);
  const long = 'Uzun açıklama '.repeat(250);
  const big = [HEADER, ...Array.from({ length: 40 }, (_, i) => row(`M${i}`, `https://galeri.com/${i}.jpg`, long))].join('\n');
  expect(big.length).toBeGreaterThan(100_000);
  const p = await t.http().post(`/companies/${companyId}/imports/preview`).set(owner.auth).send({ csv: big });
  expect(p.status).toBe(201);
  expect(p.body.valid).toBe(40);
  await t.prisma.importJob.create({ data: { companyId, userId: owner.user.id, status: 'running', total: 1, input: [] } });
  const busy = await t.http().post(`/companies/${companyId}/imports`).set(owner.auth).send({ csv: big });
  expect(busy.body.code).toBe('IMPORT_RUNNING');
});
