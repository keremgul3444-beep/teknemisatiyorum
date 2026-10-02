import fs from 'fs';
import path from 'path';

export const ROUTES = [
  '_layout', 'index', '(tabs)/_layout', '(tabs)/kesfet', '(tabs)/hizmetler', '(tabs)/ekle', '(tabs)/mesajlar', '(tabs)/profil',
  'onboarding', 'auth/login', 'auth/otp', 'auth/kvkk', 'verify/identity', 'verify/professional',
  'asistan', 'ilanlar', 'ilan/[id]', 'degerleme', 'aramalar',
  'ilan-ver', 'tekne-ekle', 'is/yeni', 'is/[id]', 'odeme',
  'usta/index', 'usta/[id]', 'ekspertiz/index', 'ekspertiz/rapor',
  'kaptan/index', 'kaptan/[id]', 'broker/index', 'broker/[id]',
  'sohbet/[id]', 'teknelerim/index', 'teknelerim/[id]', 'devir',
  'profil/ilanlarim', 'profil/favoriler', 'profil/islerim', 'profil/odemeler',
  'profil/ayarlar', 'profil/cihazlar', 'profil/hesap-sil',
  'panel/hizmet', 'panel/kurumsal',
  'admin/_layout', 'admin/index', 'admin/ilanlar', 'admin/belgeler', 'admin/broker', 'admin/ekspertiz',
  'admin/kullanicilar', 'admin/odemeler', 'admin/kayitlar', 'admin/sikayetler', 'bildir/[id]',
];

test.each(ROUTES)('%s sayfası mevcut', (r) => {
  expect(fs.existsSync(path.join(__dirname, '..', 'src', 'app', `${r}.tsx`))).toBe(true);
});
