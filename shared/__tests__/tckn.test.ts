import { isValidTckn } from '../src/tckn';

test('geçerli numara', () => { expect(isValidTckn('10000000146')).toBe(true); });
test('0 ile başlayan geçersiz', () => { expect(isValidTckn('01234567890')).toBe(false); });
test('kontrol hanesi yanlış', () => { expect(isValidTckn('10000000147')).toBe(false); });
test('uzunluk ve rakam', () => {
  expect(isValidTckn('1234')).toBe(false);
  expect(isValidTckn('1000000014a')).toBe(false);
});
