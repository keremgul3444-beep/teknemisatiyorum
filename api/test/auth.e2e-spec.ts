import { createTestApp, type TestApp } from './setup';
import { CLOCK, type Clock } from '../src/common/clock';
import { SMS_SENDER, DevSmsSender } from '../src/adapters/sms';

let t: TestApp;
let now = new Date('2026-10-01T10:00:00Z');
const clock: Clock = { now: () => now };
const advance = (ms: number) => { now = new Date(now.getTime() + ms); };
let sms: DevSmsSender;

const lastCode = (phone: string) => sms.inbox().filter((m) => m.phone === phone).at(-1)!.code;
async function login(phone: string, device = 'Test cihazı') {
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  const r = await t.http().post('/auth/verify').send({ phone, code: lastCode(normalize(phone)), deviceName: device });
  expect(r.status).toBe(200);
  return r.body as { accessToken: string; refreshToken: string; user: { id: string; verifyLevel: number } };
}
const normalize = (p: string) => '+90' + p.replace(/\D/g, '').slice(-10);

beforeAll(async () => {
  sms = new DevSmsSender();
  t = await createTestApp({ override: (b) => { b.overrideProvider(CLOCK).useValue(clock); b.overrideProvider(SMS_SENDER).useValue(sms); } });
});
afterAll(async () => { await t.close(); });
beforeEach(() => advance(10 * 60_000)); // her test yeni bir dakikada başlasın

test('kod → doğrulama → korumalı uç nokta', async () => {
  const s = await login('0532 111 11 11');
  expect(s.user.verifyLevel).toBe(1);
  const r = await t.http().get('/auth/sessions').set('Authorization', `Bearer ${s.accessToken}`);
  expect(r.status).toBe(200);
  expect(r.body).toHaveLength(1);
  expect(r.body[0]).toMatchObject({ deviceName: 'Test cihazı', current: true });
});

test('farklı yazımlar aynı kullanıcıya gider', async () => {
  const a = await login('0532 222 22 22');
  advance(2 * 60_000);
  const b = await login('+90 532 222 2222');
  expect(b.user.id).toBe(a.user.id);
});

test('geçersiz numara reddedilir', async () => {
  const r = await t.http().post('/auth/otp').send({ phone: '123' });
  expect(r.status).toBe(400);
  expect(r.body.code).toBe('VALIDATION');
});

test('bir dakika içinde ikinci kod istenemez', async () => {
  await t.http().post('/auth/otp').send({ phone: '05323333333' }).expect(204);
  const r = await t.http().post('/auth/otp').send({ phone: '05323333333' });
  expect(r.status).toBe(429);
  expect(r.body.code).toBe('OTP_RATE');
});

test('5 yanlış denemeden sonra doğru kod da kabul edilmez', async () => {
  const phone = '05324444444';
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  const code = lastCode(normalize(phone));
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    const r = await t.http().post('/auth/verify').send({ phone, code: wrong, deviceName: 'x' });
    expect(r.body.code).toBe('OTP_INVALID');
  }
  const r = await t.http().post('/auth/verify').send({ phone, code, deviceName: 'x' });
  expect(r.status).toBe(401);
  expect(r.body.code).toBe('OTP_LOCKED');
});

test('süresi geçen kod', async () => {
  const phone = '05325555555';
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  advance(5 * 60_000 + 1000);
  const r = await t.http().post('/auth/verify').send({ phone, code: lastCode(normalize(phone)), deviceName: 'x' });
  expect(r.body.code).toBe('OTP_EXPIRED');
});

test('aynı kodla eşzamanlı iki doğrulama: yalnızca biri oturum açar', async () => {
  const phone = '05326666666';
  await t.http().post('/auth/otp').send({ phone }).expect(204);
  const code = lastCode(normalize(phone));
  const [a, b] = await Promise.all([
    t.http().post('/auth/verify').send({ phone, code, deviceName: 'a' }),
    t.http().post('/auth/verify').send({ phone, code, deviceName: 'b' }),
  ]);
  expect([a.status, b.status].sort()).toEqual([200, 401]);
});

test('yenileme anahtarı döner; eskisi tekrar kullanılırsa zincir iptal edilir', async () => {
  const s = await login('05327777777');
  const r1 = await t.http().post('/auth/refresh').send({ refreshToken: s.refreshToken });
  expect(r1.status).toBe(200);
  expect(r1.body.refreshToken).not.toBe(s.refreshToken);
  // eski anahtar tolerans penceresinden (10 sn) sonra ikinci kez → çalınma şüphesi
  advance(11_000);
  const reuse = await t.http().post('/auth/refresh').send({ refreshToken: s.refreshToken });
  expect(reuse.status).toBe(401);
  expect(reuse.body.code).toBe('REFRESH_REUSED');
  // yeni anahtar da artık geçersiz, mevcut giriş anahtarı da
  expect((await t.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken })).status).toBe(401);
  expect((await t.http().get('/auth/sessions').set('Authorization', `Bearer ${r1.body.accessToken}`)).status).toBe(401);
});

test('aynı anda gelen iki yenileme oturumu kapatmaz; ikisi de aynı yeni anahtarı alır', async () => {
  const s0 = await login('05327777701');
  const [a, b] = await Promise.all([
    t.http().post('/auth/refresh').send({ refreshToken: s0.refreshToken }),
    t.http().post('/auth/refresh').send({ refreshToken: s0.refreshToken }),
  ]);
  expect([a.status, b.status]).toEqual([200, 200]);
  expect(a.body.refreshToken).toBe(b.body.refreshToken);
  // zincir sağlam: yeni anahtar çalışır, giriş anahtarları geçerli
  expect((await t.http().get('/auth/sessions').set('Authorization', `Bearer ${b.body.accessToken}`)).status).toBe(200);
  expect((await t.http().post('/auth/refresh').send({ refreshToken: a.body.refreshToken })).status).toBe(200);
});

test('tolerans penceresinde (10 sn) eski anahtar aynı yeni anahtarı döndürür', async () => {
  const s0 = await login('05327777702');
  const r1 = await t.http().post('/auth/refresh').send({ refreshToken: s0.refreshToken });
  advance(5_000);
  const r2 = await t.http().post('/auth/refresh').send({ refreshToken: s0.refreshToken });
  expect(r2.status).toBe(200);
  expect(r2.body.refreshToken).toBe(r1.body.refreshToken);
});

test('başka cihazın oturumu kapatılabilir, kendi listesindeki olmayan kapatılamaz', async () => {
  const a = await login('05328888888', 'Telefon');
  advance(2 * 60_000);
  const b = await login('05328888888', 'Tablet');
  const list = await t.http().get('/auth/sessions').set('Authorization', `Bearer ${a.accessToken}`);
  expect(list.body).toHaveLength(2);
  const tablet = list.body.find((s: { deviceName: string }) => s.deviceName === 'Tablet');
  expect((await t.http().delete(`/auth/sessions/${tablet.id}`).set('Authorization', `Bearer ${a.accessToken}`)).status).toBe(204);
  expect((await t.http().post('/auth/refresh').send({ refreshToken: b.refreshToken })).status).toBe(401);
  const other = await login('05329999999');
  const r = await t.http().delete(`/auth/sessions/${tablet.id}`).set('Authorization', `Bearer ${other.accessToken}`);
  expect(r.status).toBe(404);
});

test('çıkış yapınca oturum kapanır', async () => {
  const s = await login('05321212121');
  expect((await t.http().post('/auth/logout').set('Authorization', `Bearer ${s.accessToken}`)).status).toBe(204);
  expect((await t.http().post('/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
});

test('tolerans süresi geçince şifreli halef anahtarı veritabanından silinir', async () => {
  const s0 = await login('05327777703');
  const r1 = await t.http().post('/auth/refresh').send({ refreshToken: s0.refreshToken });
  advance(11_000);
  await t.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(200);
  const leftovers = await t.prisma.session.count({ where: { user: { phone: '+905327777703' }, graceRefreshEnc: { not: null }, graceUntil: { lte: new Date(clock.now().getTime()) } } });
  expect(leftovers).toBe(0);
});
