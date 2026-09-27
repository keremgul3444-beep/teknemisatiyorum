import sharp from 'sharp';
import { createTestApp, type TestApp } from './setup';
import { jpegWithExif, loginAs } from './helpers';

let t: TestApp;
beforeAll(async () => { t = await createTestApp(); });
afterAll(async () => { await t.close(); });

const binary = (res: import('superagent').Response, cb: (e: Error | null, b: Buffer) => void) => {
  const d: Buffer[] = [];
  res.on('data', (c: Buffer) => d.push(c));
  res.on('end', () => cb(null, Buffer.concat(d)));
};

test('izinli genişlikte WebP döner (önbellekten ikinci kez de); izinsiz genişlik reddedilir', async () => {
  const u = await loginAs(t);
  const id = (await t.http().post('/media').set(u.auth).field('visibility', 'public').attach('file', await jpegWithExif(1800, 1200), 'p.jpg')).body.id;
  for (let i = 0; i < 2; i++) {
    const r = await t.http().get(`/media/${id}?w=400`).buffer(true).parse(binary);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/webp');
    // Uzun önbellek yok: hesabı silinen kişinin fotoğrafı en geç bir günde her yerden kalkmalı (KVKK).
    expect(r.headers['cache-control']).toBe('public, max-age=86400');
    expect((await sharp(r.body as Buffer).metadata()).width).toBe(400);
  }
  expect((await t.http().get(`/media/${id}?w=401`)).status).toBe(400);
  expect((await t.http().get(`/media/${id}`)).headers['content-type']).toBe('image/jpeg');
});

test('korumalı dosyanın küçük kopyası da açılmaz', async () => {
  const u = await loginAs(t);
  const id = (await t.http().post('/media').set(u.auth).field('visibility', 'private').attach('file', await jpegWithExif(800, 600), 'p.jpg')).body.id;
  expect((await t.http().get(`/media/${id}?w=400`)).status).toBe(404);
});
