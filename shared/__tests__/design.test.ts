import { colors, cssVariables, radius } from '../src/design';

test('renkler uygulamadaki değerlerle aynı', () => {
  expect(colors.bg).toBe('#F4EFE6');
  expect(colors.primary).toBe('#0F6E68');
  expect(radius.card).toBe(18);
});

test('web için CSS değişkenleri üretilir', () => {
  const css = cssVariables();
  expect(css).toContain('--c-bg:#F4EFE6');
  expect(css).toContain('--c-primary:#0F6E68');
  expect(css).toContain('--r-card:18px');
  expect(css.startsWith(':root{')).toBe(true);
});
