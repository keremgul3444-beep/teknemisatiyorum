import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';
import { MediaService, MEDIA_LIMITS } from '../src/modules/media/media.service';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const DAY = 864e5;
const upload = async (auth: Record<string, string>, visibility: 'public' | 'private' = 'public') =>
  (await t.http().post('/media').set(auth).field('visibility', visibility).attach('file', await jpegWithExif(300, 200), 'p.jpg')).body.id as string;
const age = (id: string, days: number) => t.prisma.file.update({ where: { id }, data: { createdAt: new Date(Date.now() - days * DAY) } });
const listing = (ownerId: string, status: 'published' | 'removed') => t.prisma.listing.create({ data: {
  brand: 'Medya', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, status, publishedAt: new Date(),
} });

describe('herkese açık dosya erişimi', () => {
  test('ilana bağlanmamış dosya bir gün açılır, sonra kapanır; kaldırılan ilanın fotoğrafı kapanır', async () => {
    const u = await loginAs(t, { level: 2 });
    const orphan = await upload(u.auth);
    expect((await t.http().get(`/media/${orphan}`)).status).toBe(200);
    await age(orphan, 2);
    expect((await t.http().get(`/media/${orphan}`)).status).toBe(404);
    expect((await t.http().get(`/media/${orphan}?w=400`)).status).toBe(404);

    const live = await listing(u.user.id, 'published');
    const gone = await listing(u.user.id, 'removed');
    const a = await upload(u.auth);
    const b = await upload(u.auth);
    await t.prisma.listingPhoto.createMany({ data: [{ listingId: live.id, fileId: a, order: 0 }, { listingId: gone.id, fileId: b, order: 0 }] });
    await age(a, 30); await age(b, 30);
    expect((await t.http().get(`/media/${a}`)).status).toBe(200);
    expect((await t.http().get(`/media/${b}`)).status).toBe(404);
  });

  test('yetim temizliği: bir haftadan eski bağlanmamış dosyalar silinir, ilana ve başvuruya bağlı olanlar kalır', async () => {
    const u = await loginAs(t, { level: 2 });
    const l = await listing(u.user.id, 'published');
    const [orphan, fresh, photo, doc] = [await upload(u.auth), await upload(u.auth), await upload(u.auth), await upload(u.auth, 'private')];
    await t.prisma.listingPhoto.create({ data: { listingId: l.id, fileId: photo, order: 0 } });
    await t.prisma.verificationRequest.create({ data: { userId: u.user.id, kind: 'identity', fileIds: [doc] } });
    for (const id of [orphan, photo, doc]) await age(id, 8);
    await t.app.get(MediaService).sweepOrphans();
    const left = (await t.prisma.file.findMany({ where: { id: { in: [orphan, fresh, photo, doc] } } })).map((f) => f.id).sort();
    expect(left).toEqual([fresh, photo, doc].sort());
  });
});

describe('kota ve belge güvenliği', () => {
  test('günlük yükleme sınırı ve disk payı', async () => {
    const u = await loginAs(t);
    await t.prisma.file.createMany({ data: Array.from({ length: MEDIA_LIMITS.uploadsPerDay }, (_, i) => ({ ownerId: u.user.id, visibility: 'public' as const, key: `quota/${u.user.id}/${i}`, mime: 'image/jpeg', size: 1 })) });
    const over = await t.http().post('/media').set(u.auth).field('visibility', 'public').attach('file', await jpegWithExif(300, 200), 'p.jpg');
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('UPLOAD_LIMIT');

    const v = await loginAs(t);
    await t.prisma.file.create({ data: { ownerId: v.user.id, visibility: 'public', key: `quota/${v.user.id}/big`, mime: 'image/jpeg', size: MEDIA_LIMITS.bytesPerUser, createdAt: new Date(Date.now() - 3 * DAY) } });
    const full = await t.http().post('/media').set(v.auth).field('visibility', 'public').attach('file', await jpegWithExif(300, 200), 'p.jpg');
    expect(full.body.code).toBe('STORAGE_QUOTA');
  });

  test('moderatörün başkasının belgesini açması denetim kaydına yazılır; sahibinki yazılmaz; PDF indirilir', async () => {
    const u = await loginAs(t);
    const doc = await upload(u.auth, 'private');
    await t.http().get(`/media/${doc}/signed`).set(u.auth).expect(200);
    expect(await t.prisma.auditLog.count({ where: { action: 'audit.privateFileViewed', targetId: doc } })).toBe(0);
    const m = await loginAs(t, { level: 3, roles: ['moderator'] });
    await t.http().get(`/media/${doc}/signed`).set(m.auth).expect(200);
    expect(await t.prisma.auditLog.findFirst({ where: { action: 'audit.privateFileViewed', targetId: doc } })).toMatchObject({ actorId: m.user.id, params: { ownerId: u.user.id } });

    const pdf = await t.http().post('/media').set(u.auth).field('visibility', 'private').attach('file', Buffer.from('%PDF-1.4\n%%EOF'), 'r.pdf');
    const s = await t.http().get(`/media/${pdf.body.id}/signed`).set(u.auth);
    const raw = await t.http().get(s.body.url);
    expect(raw.headers['content-disposition']).toMatch(/^attachment/);
    expect(raw.headers['x-content-type-options']).toBe('nosniff');
  });
});

test('açık taslak sayısı sınırlı', async () => {
  const u = await loginAs(t, { level: 1 });
  const body = { brand: 'Taslak', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 1000, currency: 'EUR', location: 'Bodrum' };
  for (let i = 0; i < 5; i++) await t.http().post('/listings').set(u.auth).send(body).expect(201);
  const over = await t.http().post('/listings').set(u.auth).send(body);
  expect(over.status).toBe(409);
  expect(over.body.code).toBe('TOO_MANY_DRAFTS');
});
