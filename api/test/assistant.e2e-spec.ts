import { createTestApp, type TestApp } from './setup';
import { loginAs } from './helpers';
import { LLM_CLIENT, type LlmClient } from '../src/adapters/llm';
import { AssistantService } from '../src/modules/assistant/assistant.service';

/** Test için yönlendirilebilir sahte dil modeli: ne döndüreceği ve aldığı argümanlar izlenir. */
class FakeLlm implements LlmClient {
  calls: unknown[][] = [];
  next: () => Promise<unknown> = async () => ({ equipment: [] });
  async toFilter(...args: unknown[]) {
    this.calls.push(args);
    return this.next();
  }
}

let t: TestApp;
const llm = new FakeLlm();
let ownerId: string;

beforeAll(async () => {
  t = await createTestApp({ override: (b) => { b.overrideProvider(LLM_CLIENT).useValue(llm); } });
  const o = await loginAs(t);
  ownerId = o.user.id;
  const base = { model: 'M', cabins: 2, engine: 'e', description: 'd', status: 'published' as const, badges: [], ownerId, publishedAt: new Date() };
  await t.prisma.listing.createMany({ data: [
    { ...base, brand: 'Galeon', year: 2020, lengthM: 11.3, type: 'motoryat', price: 310000, currency: 'EUR', location: 'Çeşme', equipment: ['jenerator', 'branda'] },
    { ...base, brand: 'Lagoon', year: 2018, lengthM: 12.8, type: 'katamaran', price: 395000, currency: 'EUR', location: 'Göcek', equipment: ['jenerator', 'branda'] },
    { ...base, brand: 'Bavaria', year: 2016, lengthM: 11.3, type: 'yelkenli', price: 105000, currency: 'EUR', location: 'Fethiye', equipment: ['otopilot'] },
  ] });
});
afterAll(async () => { await t.close(); });
beforeEach(() => { llm.calls = []; t.app.get(AssistantService).resetUsage(); });

const search = (text: string, auth?: Record<string, string>) => {
  const r = t.http().post('/assistant/search').send({ text });
  return auth ? r.set(auth) : r;
};

test('dil modelinin filtresiyle veritabanından sonuç gelir', async () => {
  llm.next = async () => ({ maxLength: 12, minYear: 2015, equipment: ['jenerator', 'branda'] });
  const r = await search('12 metreye kadar jeneratörlü brandalı 2015 sonrası');
  expect(r.status).toBe(200);
  expect(r.body.source).toBe('llm');
  expect(r.body.exact.map((l: { brand: string }) => l.brand)).toEqual(['Galeon']);
  expect(r.body.near.map((n: { listing: { brand: string }; missing: string[] }) => [n.listing.brand, n.missing])).toEqual([['Lagoon', ['length']]]);
});

test('şema dışı ya da kötü niyetli çıktı elenir, arama güvenli alanlarla yapılır', async () => {
  llm.next = async () => ({ minLength: -5, extra: 'DROP TABLE "Listing"', equipment: ['jenerator', 'uçak'], type: 'motoryat' });
  const r = await search('kötü niyetli çıktı denemesi motoryat');
  expect(r.status).toBe(200);
  expect(r.body.source).toBe('rules');
  expect(r.body.query).not.toHaveProperty('extra');
  expect(await t.prisma.listing.count()).toBe(3);
});

test('dil modeli hata verirse kural tabanlı ayrıştırıcı devreye girer', async () => {
  llm.next = async () => { throw new Error('ağ hatası'); };
  const r = await search('Fethiye yelkenli');
  expect(r.body.source).toBe('rules');
  expect(r.body.exact.map((l: { brand: string }) => l.brand)).toEqual(['Bavaria']);
});

test('dil modeli yanıt vermezse zaman aşımıyla kural tabanlıya düşer', async () => {
  llm.next = () => new Promise((res) => setTimeout(() => res({ equipment: [] }), 6000));
  const started = Date.now();
  const r = await search('Göcek katamaran');
  expect(Date.now() - started).toBeLessThan(5500);
  expect(r.body.source).toBe('rules');
  expect(r.body.exact.map((l: { brand: string }) => l.brand)).toEqual(['Lagoon']);
});

test('aynı metin ikinci kez modeli çağırmaz (önbellek)', async () => {
  llm.next = async () => ({ type: 'yelkenli', equipment: [] });
  await search('önbellek deneme yelkenli');
  await search('  Önbellek deneme YELKENLİ ');
  expect(llm.calls).toHaveLength(1);
});

test('modele yalnızca arama metni gider, kullanıcı kimliği gitmez', async () => {
  const a = await loginAs(t, { name: 'Gizli Ad Soyad' });
  llm.next = async () => ({ equipment: [] });
  await search('kimlik sızıntısı denemesi', a.auth);
  expect(llm.calls).toHaveLength(1);
  const sent = JSON.stringify(llm.calls[0]);
  expect(sent).not.toContain(a.user.id);
  expect(sent).not.toContain('Gizli');
  expect(sent).not.toContain(a.user.phone!);
});

test('misafir günlük kotayı aşınca model çağrılmaz ama arama sürer', async () => {
  llm.next = async () => ({ equipment: [] });
  for (let i = 0; i < 20; i++) await search(`kota ${i}`);
  expect(llm.calls).toHaveLength(20);
  const r = await search('kota aşımı Fethiye yelkenli');
  expect(llm.calls).toHaveLength(20);
  expect(r.body.source).toBe('rules');
  expect(r.body.exact).toHaveLength(1);
});

test('boş ya da çok uzun metin reddedilir', async () => {
  expect((await search('')).status).toBe(400);
  expect((await search('x'.repeat(501))).status).toBe(400);
});
