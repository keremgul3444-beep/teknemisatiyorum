import sharp from 'sharp';
import { createTestApp, type TestApp } from './setup';
import { deepContains, jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const TCKN = '10000000146';

describe('profil', () => {
  test('GET /me görünümü ve güncelleme', async () => {
    const a = await loginAs(t);
    const r = await t.http().patch('/me').set(a.auth).send({ name: 'Deniz Yılmaz', email: 'd@ornek.com', lang: 'en' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'Deniz Yılmaz', email: 'd@ornek.com', lang: 'en' });
    expect(r.body).not.toHaveProperty('nationalIdEnc');
  });

  test('geçersiz e-posta reddedilir', async () => {
    const a = await loginAs(t);
    expect((await t.http().patch('/me').set(a.auth).send({ email: 'olmaz' })).status).toBe(400);
  });
});

describe('kimlik doğrulama', () => {
  test('geçerli TCKN → seviye 2, numara hiçbir yanıtta görünmez', async () => {
    const a = await loginAs(t);
    const r = await t.http().post('/verification/identity').set(a.auth).send({ tckn: TCKN, firstName: 'Deniz', lastName: 'Yılmaz', birthYear: 1988 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ verifyLevel: 2, nationalIdLast2: '46' });
    expect(deepContains(r.body, TCKN)).toBe(false);
    const me = await t.http().get('/me').set(a.auth);
    expect(deepContains(me.body, TCKN)).toBe(false);
    const row = await t.prisma.user.findUnique({ where: { id: a.user.id } });
    expect(row!.nationalIdEnc).toBeTruthy();
    expect(row!.nationalIdEnc).not.toContain(TCKN);
  });

  test('geçersiz TCKN', async () => {
    const a = await loginAs(t);
    const r = await t.http().post('/verification/identity').set(a.auth).send({ tckn: '10000000147', firstName: 'A', lastName: 'B', birthYear: 1990 });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('INVALID_TCKN');
  });

  test('pasaport → belge incelemesine düşer, seviye henüz değişmez', async () => {
    const a = await loginAs(t);
    const f = await t.http().post('/media').set(a.auth).field('visibility', 'private').attach('file', await jpegWithExif(800, 600), 'pasaport.jpg');
    const r = await t.http().post('/verification/identity').set(a.auth)
      .send({ passport: 'U1234567', nationality: 'DE', firstName: 'Anna', lastName: 'Schmidt', birthYear: 1985, fileId: f.body.id });
    expect(r.status).toBe(200);
    expect(r.body.verifyLevel).toBe(1);
    const reqs = await t.http().get('/verification/requests/mine').set(a.auth);
    expect(reqs.body[0]).toMatchObject({ kind: 'identity', status: 'pending' });
  });
});

describe('dosyalar', () => {
  test('fotoğraf küçültülür ve EXIF silinir', async () => {
    const a = await loginAs(t);
    const r = await t.http().post('/media').set(a.auth).field('visibility', 'public').attach('file', await jpegWithExif(), 'tekne.jpg');
    expect(r.status).toBe(201);
    const img = await t.http().get(`/media/${r.body.id}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(img.status).toBe(200);
    const meta = await sharp(img.body as Buffer).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2000);
    expect(meta.exif).toBeUndefined();
  });

  test('10 MB üstü ve desteklenmeyen tür', async () => {
    const a = await loginAs(t);
    const big = await t.http().post('/media').set(a.auth).field('visibility', 'public').attach('file', Buffer.alloc(11 * 1024 * 1024, 1), 'buyuk.jpg');
    expect(big.status).toBe(413);
    const txt = await t.http().post('/media').set(a.auth).field('visibility', 'public').attach('file', Buffer.from('merhaba'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(415);
  });

  test('uzantısı jpg ama içeriği resim olmayan dosya reddedilir', async () => {
    const a = await loginAs(t);
    const r = await t.http().post('/media').set(a.auth).field('visibility', 'public').attach('file', Buffer.from('%PDF sahte'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(415);
  });

  test('korumalı dosya: başkası göremez, sahibi imzalı bağlantıyla indirir', async () => {
    const a = await loginAs(t);
    const b = await loginAs(t);
    const f = await t.http().post('/media').set(a.auth).field('visibility', 'private').attach('file', await jpegWithExif(400, 300), 'ruhsat.jpg');
    expect((await t.http().get(`/media/${f.body.id}`)).status).toBe(404);
    expect((await t.http().get(`/media/${f.body.id}/signed`).set(b.auth)).status).toBe(404);
    const s = await t.http().get(`/media/${f.body.id}/signed`).set(a.auth);
    expect(s.status).toBe(200);
    // Bağlantılar göreli döner: istemci kendi sunucu adresinin önüne ekler (tünel/proxy arkasında da çalışsın).
    expect(s.body.url).toMatch(/^\/media\//);
    const path = s.body.url as string;
    expect((await t.http().get(path)).status).toBe(200);
    expect((await t.http().get(path.replace(/sig=[^&]+/, 'sig=bozuk'))).status).toBe(404);
  });
});

describe('belge başvurusu', () => {
  test('yalnızca kendi korumalı dosyasıyla başvurulur', async () => {
    const a = await loginAs(t, { level: 2 });
    const b = await loginAs(t, { level: 2 });
    const mine = await t.http().post('/media').set(a.auth).field('visibility', 'private').attach('file', await jpegWithExif(400, 300), 'b.jpg');
    const theirs = await t.http().post('/media').set(b.auth).field('visibility', 'private').attach('file', await jpegWithExif(400, 300), 'b.jpg');
    expect((await t.http().post('/verification/requests').set(a.auth).send({ kind: 'usta', fileIds: [theirs.body.id] })).status).toBe(404);
    const ok = await t.http().post('/verification/requests').set(a.auth).send({ kind: 'usta', fileIds: [mine.body.id] });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('pending');
  });
});

describe('kurumsal hesap', () => {
  test('firma kurulur, mevcut kullanıcı personel olarak eklenir', async () => {
    const owner = await loginAs(t, { level: 2 });
    const staff = await loginAs(t);
    const c = await t.http().post('/companies').set(owner.auth).send({ name: 'Mavi Koy Yatçılık', kind: 'broker', city: 'Bodrum' });
    expect(c.status).toBe(201);
    const m = await t.http().post(`/companies/${c.body.id}/members`).set(owner.auth).send({ phone: staff.user.phone, role: 'staff' });
    expect(m.status).toBe(201);
    const outsider = await loginAs(t, { level: 2 });
    expect((await t.http().post(`/companies/${c.body.id}/members`).set(outsider.auth).send({ phone: staff.user.phone, role: 'staff' })).status).toBe(404);
  });

  test('seviye 1 firma kuramaz', async () => {
    const a = await loginAs(t);
    expect((await t.http().post('/companies').set(a.auth).send({ name: 'X', kind: 'galeri', city: 'Çeşme' })).status).toBe(403);
  });
});

describe('hesap silme', () => {
  test('kişisel alanlar temizlenir, oturum kapanır', async () => {
    const a = await loginAs(t, { level: 2 });
    await t.http().post('/verification/identity').set(a.auth).send({ tckn: TCKN, firstName: 'A', lastName: 'B', birthYear: 1990 });
    expect((await t.http().delete('/me').set(a.auth)).status).toBe(204);
    const row = await t.prisma.user.findUnique({ where: { id: a.user.id } });
    expect(row).toMatchObject({ phone: null, name: null, email: null, nationalIdEnc: null, nationalIdLast2: null });
    expect(row!.deletedAt).toBeTruthy();
    expect((await t.http().get('/me').set(a.auth)).status).toBe(401);
  });
});
