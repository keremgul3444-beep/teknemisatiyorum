import { expect, test } from 'vitest';
import { checkoutTarget } from '../src/lib/checkout';

const ORIGIN = 'http://localhost:3001';
const PAY = 'https://pos.ornek.com';

test('deneme ödeme sayfası İngilizce kullanıcıda /en önekiyle açılır', () => {
  expect(checkoutTarget('http://localhost:3001/odeme/deneme?order=o1', ORIGIN, 'en')).toBe('http://localhost:3001/en/odeme/deneme?order=o1');
  expect(checkoutTarget('http://localhost:3001/odeme/deneme?order=o1', ORIGIN, 'tr')).toBe('http://localhost:3001/odeme/deneme?order=o1');
  expect(checkoutTarget('http://localhost:3001/en/odeme/deneme?order=o1', ORIGIN, 'en')).toBe('http://localhost:3001/en/odeme/deneme?order=o1');
});

test('dış ödeme sağlayıcısının adresine dokunulmaz; tanımsız yere gidilmez', () => {
  expect(checkoutTarget(`${PAY}/checkout?t=1`, ORIGIN, 'en', PAY)).toBe(`${PAY}/checkout?t=1`);
  expect(checkoutTarget('https://kotu.site/x', ORIGIN, 'en', PAY)).toBeNull();
  expect(checkoutTarget('https://kotu.site/x', ORIGIN, 'tr')).toBeNull();
});
