import { whatsappUrl } from '../src/contact';

test('WhatsApp bağlantısı', () => {
  expect(whatsappUrl('+905321234567', 'Bavaria C41 ilanı hakkında')).toBe('https://wa.me/905321234567?text=Bavaria%20C41%20ilan%C4%B1%20hakk%C4%B1nda');
  expect(whatsappUrl('0532 123 45 67')).toBe('https://wa.me/905321234567');
  expect(whatsappUrl('5321234567')).toBe('https://wa.me/905321234567');
  expect(whatsappUrl('0044 7700 900123')).toBe('https://wa.me/447700900123');
  expect(whatsappUrl('123')).toBeNull();
});

import { shortName } from '../src/contact';
test('herkese açık satıcı adı soyadın baş harfiyle kısalır', () => {
  expect(shortName('Deniz Yılmaz')).toBe('Deniz Y.');
  expect(shortName('Ali Rıza İnce')).toBe('Ali İ.');
  expect(shortName('Deniz Y.')).toBe('Deniz Y.');
  expect(shortName('  ')).toBeNull();
  expect(shortName(null)).toBeNull();
});
