import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { MESSAGE_LIMITS } from '../src/modules/messages/messages.module';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const listing = (ownerId: string) => t.prisma.listing.create({ data: {
  brand: 'Mesaj', model: 'T', year: 2018, lengthM: 9, type: 'yelkenli', price: 50000, currency: 'EUR', location: 'Bodrum',
  equipment: [], badges: [], cabins: 1, engine: '', description: '', ownerId, status: 'published', publishedAt: new Date(),
} });
const open = async (auth: Record<string, string>, listingId: string) =>
  (await t.http().post('/conversations').set(auth).send({ subjectKind: 'listing', subjectId: listingId })).body.id as string;
const say = (auth: Record<string, string>, id: string, text = 'Merhaba') => t.http().post(`/conversations/${id}/messages`).set(auth).send({ text });

test('engelleme: iki taraf da yazamaz, bildirim gitmez; engeli kaldıran yeniden yazabilir', async () => {
  const seller = await loginAs(t, { level: 2 });
  const buyer = await loginAs(t);
  const c = await open(buyer.auth, (await listing(seller.user.id)).id);
  await say(buyer.auth, c).expect(201);
  await t.http().post(`/conversations/${c}/block`).set(seller.auth).expect(204);
  const blocked = await say(buyer.auth, c, 'Neden yanıt yok?');
  expect(blocked.status).toBe(403);
  expect(blocked.body.code).toBe('BLOCKED');
  expect((await say(seller.auth, c)).status).toBe(403);
  expect((await t.http().get(`/conversations/${c}/messages`).set(seller.auth)).body.blocked).toBe('me');
  expect((await t.http().get(`/conversations/${c}/messages`).set(buyer.auth)).body.blocked).toBe('them');
  expect((await t.http().post(`/conversations/${c}/block`).set((await loginAs(t)).auth)).status).toBe(404);
  await t.http().post(`/conversations/${c}/unblock`).set(seller.auth).expect(204);
  await say(seller.auth, c, 'Buyurun').expect(201);
});

test('yanıt gelmeden en fazla beş mesaj; saatlik ve günlük sınırlar', async () => {
  const seller = await loginAs(t, { level: 2 });
  const buyer = await loginAs(t);
  const c = await open(buyer.auth, (await listing(seller.user.id)).id);
  for (let i = 0; i < MESSAGE_LIMITS.unansweredInRow; i++) await say(buyer.auth, c, `Mesaj ${i}`).expect(201);
  expect((await say(buyer.auth, c)).body.code).toBe('AWAITING_REPLY');
  await say(seller.auth, c, 'Evet').expect(201);
  await say(buyer.auth, c).expect(201);

  const spammer = await loginAs(t);
  const c2 = await open(spammer.auth, (await listing(seller.user.id)).id);
  await t.prisma.message.createMany({ data: Array.from({ length: MESSAGE_LIMITS.messagesPerHour }, () => ({ conversationId: c2, senderId: spammer.user.id, text: 'x' })) });
  expect((await say(spammer.auth, c2)).body.code).toBe('MESSAGE_LIMIT');

  const opener = await loginAs(t);
  const ls = await Promise.all(Array.from({ length: MESSAGE_LIMITS.newConversationsPerDay + 1 }, () => listing(seller.user.id)));
  for (const l of ls.slice(0, -1)) await t.http().post('/conversations').set(opener.auth).send({ subjectKind: 'listing', subjectId: l.id }).expect(201);
  const over = await t.http().post('/conversations').set(opener.auth).send({ subjectKind: 'listing', subjectId: ls.at(-1)!.id });
  expect(over.status).toBe(429);
  expect(over.body.code).toBe('CONVERSATION_LIMIT');
  // Var olan sohbete dönmek sınıra sayılmaz.
  expect((await t.http().post('/conversations').set(opener.auth).send({ subjectKind: 'listing', subjectId: ls[0].id })).status).toBe(201);
});
