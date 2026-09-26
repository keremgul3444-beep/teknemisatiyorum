// Kullanıcının "hepsini düzelt" talebi: ertelenen inceleme bulgularına karşı gerileme testleri.
import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs, randomTckn } from './helpers';
import { isValidTckn } from '@tms/shared';
import { AssistantService } from '../src/modules/assistant/assistant.service';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const newListing = async (auth: Record<string, string>) =>
  (await t.http().post('/listings').set(auth).send({ brand: 'Sil', model: 'Test', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' })).body.id as string;

test('yardımcı geçerli T.C. numarası üretir', () => {
  for (let i = 0; i < 20; i++) expect(isValidTckn(randomTckn())).toBe(true);
});

test('KVKK: hesap silinince ilanları yayından kalkar, açılamaz ve mesaj başlatılamaz', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await newListing(owner.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  const draft = await newListing(owner.auth);
  await t.http().delete('/me').set(owner.auth).expect(204);
  const rows = await t.prisma.listing.findMany({ where: { id: { in: [id, draft] } } });
  expect(rows.every((r) => r.status === 'removed')).toBe(true);
  const other = await loginAs(t);
  expect((await t.http().get(`/listings/${id}`).set(other.auth)).status).toBe(404);
  expect((await t.http().post('/conversations').set(other.auth).send({ subjectKind: 'listing', subjectId: id })).status).toBe(404);
});

test('KVKK: silinmiş kullanıcıyla var olan sohbete yeni mesaj yazılamaz', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await newListing(owner.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  const buyer = await loginAs(t);
  const c = await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: id });
  await t.http().delete('/me').set(owner.auth).expect(204);
  const r = await t.http().post(`/conversations/${c.body.id}/messages`).set(buyer.auth).send({ text: 'merhaba' });
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('USER_DELETED');
});

test('aynı T.C. numarası ikinci hesapta kullanılamaz; ilk hesap silinince serbest kalır', async () => {
  const tckn = randomTckn();
  const a = await loginAs(t);
  const b = await loginAs(t);
  await t.http().post('/verification/identity').set(a.auth).send({ tckn, firstName: 'A', lastName: 'B', birthYear: 1990 }).expect(200);
  const dup = await t.http().post('/verification/identity').set(b.auth).send({ tckn, firstName: 'A', lastName: 'B', birthYear: 1990 });
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe('TCKN_IN_USE');
  // aynı kişi kendi numarasını yeniden doğrulayabilir
  await t.http().post('/verification/identity').set(a.auth).send({ tckn, firstName: 'A', lastName: 'B', birthYear: 1990 }).expect(200);
  const row = await t.prisma.user.findUnique({ where: { id: a.user.id } });
  expect(row!.nationalIdHash).toBeTruthy();
  expect(row!.nationalIdHash).not.toContain(tckn);
  await t.http().delete('/me').set(a.auth).expect(204);
  expect((await t.prisma.user.findUnique({ where: { id: a.user.id } }))!.nationalIdHash).toBeNull();
  await t.http().post('/verification/identity').set(b.auth).send({ tckn, firstName: 'A', lastName: 'B', birthYear: 1990 }).expect(200);
});

test('eşzamanlı sohbet başlatma tek sohbet döndürür (500 yok)', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await newListing(owner.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  const buyer = await loginAs(t);
  const rs = await Promise.all(Array.from({ length: 6 }, () => t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: id })));
  expect(rs.map((r) => r.status).every((s) => s === 201)).toBe(true);
  expect(new Set(rs.map((r) => r.body.id)).size).toBe(1);
});

test('firma yöneticisi sahibin rolünü değiştiremez; üye değişikliği denetim kaydına düşer', async () => {
  const owner = await loginAs(t, { level: 2 });
  const admin = await loginAs(t, { level: 2 });
  const c = await t.http().post('/companies').set(owner.auth).send({ name: 'Rol Test', kind: 'galeri', city: 'Bodrum' });
  await t.http().post(`/companies/${c.body.id}/members`).set(owner.auth).send({ phone: admin.user.phone, role: 'admin' }).expect(201);
  const r = await t.http().post(`/companies/${c.body.id}/members`).set(admin.auth).send({ phone: owner.user.phone, role: 'staff' });
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('OWNER_LOCKED');
  const m = await t.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: c.body.id, userId: owner.user.id } } });
  expect(m!.role).toBe('owner');
  const logs = await t.prisma.auditLog.findMany({ where: { targetId: c.body.id, action: 'audit.memberChanged' } });
  expect(logs).toHaveLength(1);
});

test('moderatör kendi ilanına ve kendi belgesine karar veremez', async () => {
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const id = await newListing(mod.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'pending' } });
  const r = await t.http().post(`/admin/listings/${id}/decision`).set(mod.auth).send({ decision: 'approve' });
  expect(r.status).toBe(403);
  expect(r.body.code).toBe('SELF_DECISION');
  const v = await t.prisma.verificationRequest.create({ data: { userId: mod.user.id, kind: 'usta', fileIds: [] } });
  const r2 = await t.http().post(`/admin/verifications/${v.id}/decision`).set(mod.auth).send({ decision: 'approve' });
  expect(r2.status).toBe(403);
  expect((await t.prisma.verificationRequest.findUnique({ where: { id: v.id } }))!.status).toBe('pending');
});

test('herkese açık fotoğraf okumaları genel hız sınırına takılmaz', async () => {
  const u = await loginAs(t);
  const fid = (await t.http().post('/media').set(u.auth).field('visibility', 'public').attach('file', await jpegWithExif(200, 100), 'p.jpg')).body.id;
  let last = 0;
  for (let i = 0; i < 130; i++) last = (await t.http().get(`/media/${fid}`)).status;
  expect(last).toBe(200);
});

test('ilan ve sohbet listeleri sınırlı sayıda döner', async () => {
  const u = await loginAs(t, { level: 2 });
  await t.prisma.listing.createMany({ data: Array.from({ length: 205 }, () => ({ ownerId: u.user.id, brand: 'Çok', model: 'X', year: 2010, lengthM: 8, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' })) });
  const r = await t.http().get('/me/listings').set(u.auth);
  expect(r.body.length).toBe(200);
});

test('asistan kota sayacı gün değişince eski günleri tutmaz', async () => {
  let now = new Date('2026-09-26T10:00:00Z');
  const svc = new AssistantService({} as never, { now: () => now } as never, {} as never) as unknown as { takeQuota(w: { ip: string }, n: number): boolean; usage: Map<string, number> };
  for (let i = 0; i < 30; i++) svc.takeQuota({ ip: `1.1.1.${i}` }, now.getTime());
  expect(svc.usage.size).toBe(30);
  now = new Date('2026-09-27T10:00:00Z');
  svc.takeQuota({ ip: '2.2.2.2' }, now.getTime());
  expect(svc.usage.size).toBe(1);
});

test('ayarlar sunucuda saklanır; pazarlama izni denetim kaydına düşer', async () => {
  const u = await loginAs(t);
  const r = await t.http().patch('/me').set(u.auth).send({ lang: 'en', prefs: { notifyMessages: false, notifyMatches: true, notifyMarketing: false, phoneVisible: true, marketingConsent: true } });
  expect(r.status).toBe(200);
  expect(r.body.lang).toBe('en');
  expect(r.body.prefs).toMatchObject({ notifyMessages: false, phoneVisible: true, marketingConsent: true });
  const me = await t.http().get('/me').set(u.auth);
  expect(me.body.prefs.phoneVisible).toBe(true);
  const logs = await t.prisma.auditLog.findMany({ where: { actorId: u.user.id, action: 'audit.marketingConsent' } });
  expect(logs).toHaveLength(1);
  // bilinmeyen alan kabul edilmez
  expect((await t.http().patch('/me').set(u.auth).send({ prefs: { admin: true } })).status).toBe(400);
});

test('telefonunu görünür yapan satıcının numarası sohbette paylaşmadan görünür', async () => {
  const owner = await loginAs(t, { level: 2 });
  const id = await newListing(owner.auth);
  await t.prisma.listing.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  const buyer = await loginAs(t);
  const c = await t.http().post('/conversations').set(buyer.auth).send({ subjectKind: 'listing', subjectId: id });
  expect((await t.http().get(`/conversations/${c.body.id}/messages`).set(buyer.auth)).body.otherPhone).toBeNull();
  await t.http().patch('/me').set(owner.auth).send({ prefs: { phoneVisible: true } }).expect(200);
  expect((await t.http().get(`/conversations/${c.body.id}/messages`).set(buyer.auth)).body.otherPhone).toBe(owner.user.phone);
});

test('KVKK: kullanıcı kendi verisinin kopyasını indirir; gizli alanlar yoktur', async () => {
  const u = await loginAs(t, { level: 2 });
  await t.http().post('/verification/identity').set(u.auth).send({ tckn: randomTckn(), firstName: 'Veri', lastName: 'Sahibi', birthYear: 1990 }).expect(200);
  const id = await newListing(u.auth);
  const r = await t.http().get('/me/export').set(u.auth);
  expect(r.status).toBe(200);
  expect(r.headers['content-disposition']).toContain('attachment');
  expect(r.body.profile.name).toBe('Veri Sahibi');
  expect(r.body.listings.map((l: { id: string }) => l.id)).toContain(id);
  for (const k of ['sessions', 'boats', 'favorites', 'savedSearches', 'conversations', 'consentHistory', 'expertiseBookings', 'brokerCases', 'notifications', 'verificationRequests']) expect(r.body).toHaveProperty(k);
  const raw = JSON.stringify(r.body);
  for (const secret of ['nationalIdEnc', 'nationalIdHash', 'refreshHash', 'codeHash']) expect(raw).not.toContain(secret);
});
