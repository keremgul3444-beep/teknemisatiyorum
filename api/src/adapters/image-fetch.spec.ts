import { fetchPublicImage, ImageFetchError, isPublicIp } from './image-fetch';

test('iç ağ, yerel ve ayrılmış adresler herkese açık sayılmaz', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.1', '169.254.169.254', '100.64.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])
    expect([ip, isPublicIp(ip)]).toEqual([ip, false]);
  for (const ip of ['8.8.8.8', '151.101.1.1', '172.32.0.1', '2606:4700::1111', '::ffff:8.8.8.8']) expect([ip, isPublicIp(ip)]).toEqual([ip, true]);
});

test('yalnızca https:443 ve herkese açık adres; iç ağ ve yanlış biçim indirilmeden reddedilir', async () => {
  const code = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ImageFetchError ? e.code : String(e)));
  expect(await code(fetchPublicImage('http://ornek.com/a.jpg'))).toBe('url');
  expect(await code(fetchPublicImage('https://ornek.com:8443/a.jpg'))).toBe('url');
  expect(await code(fetchPublicImage('https://kullanici:sifre@ornek.com/a.jpg'))).toBe('url');
  expect(await code(fetchPublicImage('https://127.0.0.1/a.jpg'))).toBe('private');
  expect(await code(fetchPublicImage('https://169.254.169.254/latest/meta-data'))).toBe('private');
  expect(await code(fetchPublicImage('https://localhost/a.jpg'))).toBe('private');
  expect(await code(fetchPublicImage('https://[::1]/a.jpg'))).toBe('private');
  expect(await code(fetchPublicImage('bozuk'))).toBe('url');
});
