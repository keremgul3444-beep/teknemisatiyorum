import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { LogbookService } from '../src/modules/boats/logbook.service';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const boat = { name: 'Deniz Kızı', brand: 'Jeanneau', model: 'SO 349', year: 2019, lengthM: 10.3 };
const listingData = (ownerId: string) => ({
  ownerId, brand: 'Azimut', model: '40', year: 2017, lengthM: 12.2, type: 'motoryat', price: 285000, currency: 'EUR' as const,
  location: 'Göcek', equipment: [], badges: [], status: 'published' as const, publishedAt: new Date(),
});

describe('tekneler ve karne', () => {
  test('tekne eklenince karne sahiplik kaydıyla başlar; sahibin eklediği kayıt beyan sayılır', async () => {
    const a = await loginAs(t);
    const b = await t.http().post('/boats').set(a.auth).send(boat);
    expect(b.status).toBe(201);
    expect(b.body.entries).toHaveLength(1);
    expect(b.body.entries[0]).toMatchObject({ kind: 'sahiplik', verified: false });
    const e = await t.http().post(`/boats/${b.body.id}/logbook`).set(a.auth).send({ kind: 'bakim', date: '2026-04-02', title: 'Motor bakımı', byName: 'Kendim' });
    expect(e.status).toBe(201);
    expect(e.body).toMatchObject({ verified: false, date: '2026-04-02' });
  });

  test('kullanıcı karne metni sistem metni önekiyle başlayamaz (platform yazısı taklidi)', async () => {
    const a = await loginAs(t);
    const b = await t.http().post('/boats').set(a.auth).send(boat);
    const send = (title: string, byName = 'Kendim') => t.http().post(`/boats/${b.body.id}/logbook`).set(a.auth).send({ kind: 'bakim', date: '2026-04-02', title, byName });
    expect((await send('i18n:badge.broker')).status).toBe(400);
    expect((await send('  I18N:logbook.owner')).status).toBe(400);
    expect((await send('Motor bakımı', 'i18n:logbook.platformSurveyor')).status).toBe(400);
    expect((await send('Motor bakımı — i18n: notu')).status).toBe(201);
  });

  test('platform kaydı doğrulanmış olarak eklenir', async () => {
    const a = await loginAs(t);
    const b = await t.http().post('/boats').set(a.auth).send(boat);
    await t.app.get(LogbookService).addVerified(b.body.id, { kind: 'ekspertiz', date: '2026-09-18', title: 'Kapsamlı ekspertiz — 82/100', byName: 'Eksper' });
    const r = await t.http().get(`/boats/${b.body.id}`).set(a.auth);
    expect(r.body.entries.some((x: { kind: string; verified: boolean }) => x.kind === 'ekspertiz' && x.verified)).toBe(true);
  });

  test('başkasının teknesi okunamaz, karnesine yazılamaz', async () => {
    const a = await loginAs(t);
    const b = await loginAs(t);
    const x = await t.http().post('/boats').set(a.auth).send(boat);
    expect((await t.http().get(`/boats/${x.body.id}`).set(b.auth)).status).toBe(404);
    expect((await t.http().post(`/boats/${x.body.id}/logbook`).set(b.auth).send({ kind: 'bakim', date: '2026-01-01', title: 'x', byName: 'y' })).status).toBe(404);
  });

  test('ilana bağlı teknenin karne özeti ilanda görünür', async () => {
    const a = await loginAs(t, { level: 2 });
    const x = await t.http().post('/boats').set(a.auth).send(boat);
    const l = await t.http().post('/listings').set(a.auth).send({
      brand: 'Jeanneau', model: 'SO 349', year: 2019, lengthM: 10.3, type: 'yelkenli', price: 98000, currency: 'EUR', location: 'Marmaris', boatId: x.body.id,
    });
    expect(l.status).toBe(201);
    expect(l.body.logbook).toMatchObject({ count: 1 });
    const other = await loginAs(t);
    const y = await t.http().post('/boats').set(other.auth).send(boat);
    expect((await t.http().patch(`/listings/${l.body.id}`).set(a.auth).send({ boatId: y.body.id })).status).toBe(404);
  });
});

describe('mesajlaşma', () => {
  test('ilan üzerinden sohbet: aynı konu tek sohbet, alıcıya bildirim', async () => {
    const seller = await loginAs(t, { name: 'Satıcı' });
    const buyer = await loginAs(t, { name: 'Alıcı' });
    const listing = await t.prisma.listing.create({ data: listingData(seller.user.id) });
    const c1 = await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: listing.id });
    expect(c1.status).toBe(201);
    const c2 = await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: listing.id });
    expect(c2.body.id).toBe(c1.body.id);
    expect((await t.http().post(`/conversations/${c1.body.id}/messages`).set(buyer.auth).send({ text: 'Merhaba, satılık mı?' })).status).toBe(201);
    const inbox = await t.http().get('/conversations').set(seller.auth);
    expect(inbox.body[0]).toMatchObject({ id: c1.body.id, otherName: 'Alıcı', unread: true, lastMessage: { text: 'Merhaba, satılık mı?' } });
    const n = await t.http().get('/notifications').set(seller.auth);
    expect(n.body[0]).toMatchObject({ key: 'notif.newMessage' });
    await t.http().post(`/conversations/${c1.body.id}/read`).set(seller.auth).expect(204);
    expect((await t.http().get('/conversations').set(seller.auth)).body[0].unread).toBe(false);
  });

  test('kendi ilanına sohbet açılamaz', async () => {
    const a = await loginAs(t);
    const l = await t.prisma.listing.create({ data: listingData(a.user.id) });
    const r = await t.http().post('/conversations').set(a.auth).send({ subjectKind: 'listing', subjectId: l.id });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('OWN_LISTING');
  });

  test('başkasının sohbeti okunamaz ve yazılamaz', async () => {
    const s = await loginAs(t);
    const b = await loginAs(t);
    const x = await loginAs(t);
    const l = await t.prisma.listing.create({ data: listingData(s.user.id) });
    const c = await t.http().post('/conversations').set(b.auth).send({ subjectKind: 'listing', subjectId: l.id });
    expect((await t.http().get(`/conversations/${c.body.id}/messages`).set(x.auth)).status).toBe(404);
    expect((await t.http().post(`/conversations/${c.body.id}/messages`).set(x.auth).send({ text: 'sızma' })).status).toBe(404);
  });

  test('numara paylaşımı tek yönlü', async () => {
    const s = await loginAs(t);
    const b = await loginAs(t);
    const l = await t.prisma.listing.create({ data: listingData(s.user.id) });
    const c = await t.http().post('/conversations').set(b.auth).send({ subjectKind: 'listing', subjectId: l.id });
    await t.http().post(`/conversations/${c.body.id}/share-phone`).set(b.auth).expect(204);
    const sellerView = await t.http().get(`/conversations/${c.body.id}/messages`).set(s.auth);
    expect(sellerView.body.otherPhone).toBe(b.user.phone);
    const buyerView = await t.http().get(`/conversations/${c.body.id}/messages`).set(b.auth);
    expect(buyerView.body.otherPhone).toBeNull();
  });
});

describe('bildirimler', () => {
  test('okundu işaretlenir, başkasının bildirimi işaretlenemez', async () => {
    const a = await loginAs(t);
    const b = await loginAs(t);
    const n = await t.prisma.notification.create({ data: { userId: a.user.id, key: 'notif.test' } });
    expect((await t.http().post(`/notifications/${n.id}/read`).set(b.auth)).status).toBe(404);
    expect((await t.http().post(`/notifications/${n.id}/read`).set(a.auth)).status).toBe(204);
    expect((await t.http().get('/notifications').set(a.auth)).body[0].readAt).toBeTruthy();
  });
});
