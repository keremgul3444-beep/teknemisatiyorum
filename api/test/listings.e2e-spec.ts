import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const draft = {
  brand: 'Beneteau', model: 'Oceanis 40', year: 2016, lengthM: 12.2, type: 'yelkenli', price: 180000, currency: 'EUR',
  location: 'Bodrum', equipment: ['branda'], cabins: 3, engine: 'Yanmar 45hp', description: 'Bakımlı.',
};
async function photo(auth: Record<string, string>) {
  const r = await t.http().post('/media').set(auth).field('visibility', 'public').attach('file', await jpegWithExif(600, 400), 'p.jpg');
  return r.body.id as string;
}
/** Yayında bir ilanı doğrudan veritabanına yazar (arama testleri için). */
async function published(ownerId: string, data: Partial<typeof draft> & { publishedAt?: Date } = {}) {
  return t.prisma.listing.create({
    data: { ...draft, ...data, ownerId, currency: (data.currency ?? draft.currency) as 'EUR', status: 'published', publishedAt: data.publishedAt ?? new Date(), badges: [] },
  });
}

describe('taslak ve sahiplik', () => {
  test('taslak oluşturulur, sahibi düzenler, başkası göremez ve düzenleyemez', async () => {
    const a = await loginAs(t);
    const b = await loginAs(t);
    const c = await t.http().post('/listings').set(a.auth).send(draft);
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ status: 'draft', brand: 'Beneteau', isMine: true });
    expect((await t.http().patch(`/listings/${c.body.id}`).set(a.auth).send({ price: 175000 })).body.price).toBe(175000);
    expect((await t.http().get(`/listings/${c.body.id}`).set(b.auth)).status).toBe(404);
    expect((await t.http().get(`/listings/${c.body.id}`)).status).toBe(404);
    expect((await t.http().patch(`/listings/${c.body.id}`).set(b.auth).send({ price: 1 })).status).toBe(404);
  });

  test('motor saati, bayrak, takas ve pazarlık saklanır; gönderilmeyen alan korunur', async () => {
    const a = await loginAs(t);
    const bare = await t.http().post('/listings').set(a.auth).send(draft);
    expect(bare.body).toMatchObject({ engineHours: null, flag: null, tradeIn: false, negotiable: false });
    const c = await t.http().post('/listings').set(a.auth).send({ ...draft, engineHours: 850, flag: 'tr', tradeIn: true });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ engineHours: 850, flag: 'tr', tradeIn: true, negotiable: false });
    const p = await t.http().patch(`/listings/${c.body.id}`).set(a.auth).send({ negotiable: true });
    expect(p.body).toMatchObject({ engineHours: 850, flag: 'tr', tradeIn: true, negotiable: true });
    // Satıcı motor saatini sonradan kaldırabilir.
    expect((await t.http().patch(`/listings/${c.body.id}`).set(a.auth).send({ engineHours: null })).body.engineHours).toBeNull();
    expect((await t.http().post('/listings').set(a.auth).send({ ...draft, flag: 'mars' })).status).toBe(400);
    expect((await t.http().post('/listings').set(a.auth).send({ ...draft, engineHours: 1e6 })).status).toBe(400);
    expect((await t.http().post('/listings').set(a.auth).send({ ...draft, engineHours: 12.5 })).status).toBe(400);
  });

  test('satılmış ilana fotoğraf eklenemez (denetimsiz görsel yayına çıkmasın)', async () => {
    const a = await loginAs(t, { level: 2 });
    const l = await published(a.user.id);
    await t.prisma.listing.update({ where: { id: l.id }, data: { status: 'sold' } });
    const r = await t.http().post(`/listings/${l.id}/photos`).set(a.auth).send({ fileIds: [await photo(a.auth)] });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('LISTING_CLOSED');
    expect(await t.prisma.listingPhoto.count({ where: { listingId: l.id } })).toBe(0);
  });

  test('tekne kimliği değişince belge/ekspertiz rozetleri düşer; fiyat ve açıklama değişikliği rozeti korur', async () => {
    const a = await loginAs(t, { level: 2 });
    const l = await published(a.user.id);
    await t.prisma.listing.update({ where: { id: l.id }, data: { badges: ['sahiplik', 'belge', 'ekspertizli', 'broker'] } });
    await t.http().patch(`/listings/${l.id}`).set(a.auth).send({ price: 170000 }).expect(200);
    await t.http().patch(`/listings/${l.id}`).set(a.auth).send({ description: 'Yeni yelken.', brand: draft.brand }).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).badges).toEqual(['sahiplik', 'belge', 'ekspertizli', 'broker']);
    await t.http().patch(`/listings/${l.id}`).set(a.auth).send({ model: 'Oceanis 46' }).expect(200);
    expect((await t.prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).badges).toEqual(['broker']);
  });

  test('satıcının "doğrulanmış" bilgisi kimlik seviyesine bağlı', async () => {
    const v = await loginAs(t, { level: 2 });
    const u = await loginAs(t, { level: 1 });
    const lv = await published(v.user.id);
    const lu = await published(u.user.id);
    expect((await t.http().get(`/listings/${lv.id}`)).body.seller.verified).toBe(true);
    expect((await t.http().get(`/listings/${lu.id}`)).body.seller.verified).toBe(false);
  });

  test('geçersiz alanlar reddedilir', async () => {
    const a = await loginAs(t);
    const r = await t.http().post('/listings').set(a.auth).send({ ...draft, lengthM: -3, type: 'uzay-gemisi' });
    expect(r.status).toBe(400);
  });

  test('yayında ilan herkese açık, satıcının telefonu görünmez', async () => {
    const a = await loginAs(t, { name: 'Ahmet K.' });
    const l = await published(a.user.id);
    const r = await t.http().get(`/listings/${l.id}`);
    expect(r.status).toBe(200);
    expect(r.body.seller).toMatchObject({ name: 'Ahmet K.' });
    expect(JSON.stringify(r.body)).not.toContain(a.user.phone!);
    expect(r.body.isMine).toBe(false);
  });
});

describe('fotoğraflar ve onaya gönderme', () => {
  test('seviye 1 onaya gönderemez (sunucu tarafı kapı)', async () => {
    const a = await loginAs(t, { level: 1 });
    const c = await t.http().post('/listings').set(a.auth).send(draft);
    const p1 = await photo(a.auth);
    await t.http().post(`/listings/${c.body.id}/photos`).set(a.auth).send({ fileIds: [p1] });
    const r = await t.http().post(`/listings/${c.body.id}/submit`).set(a.auth);
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'LEVEL_REQUIRED', params: { level: 2 } });
  });

  test('fotoğrafsız gönderilemez; fotoğraflıysa onay bekler', async () => {
    const a = await loginAs(t, { level: 2 });
    const c = await t.http().post('/listings').set(a.auth).send(draft);
    expect((await t.http().post(`/listings/${c.body.id}/submit`).set(a.auth)).body.code).toBe('PHOTO_REQUIRED');
    const ids = [await photo(a.auth), await photo(a.auth)];
    const p = await t.http().post(`/listings/${c.body.id}/photos`).set(a.auth).send({ fileIds: ids });
    expect(p.body.photos).toHaveLength(2);
    expect(p.body.photos[0].url).toBe(`/media/${ids[0]}`);
    const s = await t.http().post(`/listings/${c.body.id}/submit`).set(a.auth);
    expect(s.status).toBe(200);
    expect(s.body.status).toBe('pending');
  });

  test('başkasının dosyası eklenemez; 20 fotoğraf sınırı', async () => {
    const a = await loginAs(t, { level: 2 });
    const b = await loginAs(t, { level: 2 });
    const c = await t.http().post('/listings').set(a.auth).send(draft);
    const foreign = await photo(b.auth);
    expect((await t.http().post(`/listings/${c.body.id}/photos`).set(a.auth).send({ fileIds: [foreign] })).status).toBe(404);
    const many = await Promise.all(Array.from({ length: 21 }, () => photo(a.auth)));
    const r = await t.http().post(`/listings/${c.body.id}/photos`).set(a.auth).send({ fileIds: many });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('TOO_MANY_PHOTOS');
  });

  test('satıldı ve kaldırıldı', async () => {
    const a = await loginAs(t, { level: 2 });
    const l = await published(a.user.id);
    expect((await t.http().post(`/listings/${l.id}/sold`).set(a.auth)).body.status).toBe('sold');
    expect((await t.http().delete(`/listings/${l.id}`).set(a.auth)).status).toBe(204);
    expect((await t.prisma.listing.findUnique({ where: { id: l.id } }))!.status).toBe('removed');
  });
});

describe('arama ve kurlar', () => {
  test('yalnızca yayındaki ilanlar; kur tablosu fiyat karşılaştırmasını belirler', async () => {
    const a = await loginAs(t);
    await t.prisma.fxRate.createMany({ data: [{ currency: 'EUR', rateToTry: 48 }, { currency: 'USD', rateToTry: 41 }, { currency: 'TRY', rateToTry: 1 }], skipDuplicates: true });
    const eur = await published(a.user.id, { brand: 'KurTest', price: 40000, currency: 'EUR', location: 'Kaş' }); // 1.92M TL
    await t.prisma.listing.create({ data: { ...draft, brand: 'KurTest', ownerId: a.user.id, currency: 'EUR', status: 'pending', location: 'Kaş', price: 1, badges: [] } });
    const q = encodeURIComponent(JSON.stringify({ maxPrice: 2000000, currency: 'TRY', location: 'Kaş', equipment: [] }));
    const r1 = await t.http().get(`/listings?q=${q}`);
    expect(r1.body.items.map((l: { id: string }) => l.id)).toEqual([eur.id]);
    const admin = await loginAs(t, { level: 3, roles: ['admin'] });
    expect((await t.http().put('/admin/fx/EUR').set(admin.auth).send({ rateToTry: 55 })).status).toBe(200); // 2.2M TL
    const r2 = await t.http().get(`/listings?q=${q}`);
    expect(r2.body.items).toHaveLength(0);
  });

  test('kur tablosunu yalnızca yönetici değiştirir', async () => {
    const a = await loginAs(t, { level: 3 });
    expect((await t.http().put('/admin/fx/EUR').set(a.auth).send({ rateToTry: 1 })).status).toBe(403);
    expect((await t.http().get('/fx')).status).toBe(200);
  });

  test('bozuk filtre 400', async () => {
    expect((await t.http().get('/listings?q=%7Bbozuk')).status).toBe(400);
  });

  test('sıralama ve sayfalama', async () => {
    const a = await loginAs(t);
    for (const p of [300, 100, 200]) await published(a.user.id, { brand: 'Sirala', price: p * 1000, location: 'Didim' });
    const q = encodeURIComponent(JSON.stringify({ location: 'Didim', equipment: [] }));
    const r = await t.http().get(`/listings?q=${q}&sort=asc`);
    expect(r.body.items.map((l: { price: number }) => l.price)).toEqual([100000, 200000, 300000]);
    expect(r.body.total).toBe(3);
  });
});

describe('favoriler ve kayıtlı aramalar', () => {
  test('favori ekle/çıkar', async () => {
    const a = await loginAs(t);
    const l = await published(a.user.id);
    expect((await t.http().put(`/favorites/${l.id}`).set(a.auth)).status).toBe(204);
    expect((await t.http().get('/favorites').set(a.auth)).body.map((x: { id: string }) => x.id)).toContain(l.id);
    expect((await t.http().delete(`/favorites/${l.id}`).set(a.auth)).status).toBe(204);
    expect((await t.http().get('/favorites').set(a.auth)).body).toHaveLength(0);
  });

  test('kayıtlı aramada yeni eşleşme sayısı', async () => {
    const a = await loginAs(t);
    const s = await t.http().post('/saved-searches').set(a.auth).send({ text: 'Fethiye katamaran', filter: { location: 'Fethiye', type: 'katamaran', equipment: [] } });
    expect(s.status).toBe(201);
    await new Promise((r) => setTimeout(r, 20));
    await published(a.user.id, { location: 'Fethiye', type: 'katamaran' });
    await published(a.user.id, { location: 'Fethiye', type: 'gulet' });
    await new Promise((r) => setTimeout(r, 20));
    const list = await t.http().get('/saved-searches').set(a.auth);
    expect(list.body[0]).toMatchObject({ text: 'Fethiye katamaran', newMatches: 1 });
    await t.http().post(`/saved-searches/${s.body.id}/seen`).set(a.auth).expect(204);
    expect((await t.http().get('/saved-searches').set(a.auth)).body[0].newMatches).toBe(0);
  });
});
