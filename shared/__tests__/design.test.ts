import { colors, cssVariables, fontFamilies, radius } from '../src/design';

test('"Liman" tasarım dili: açık zemin, lacivert ana renk, turuncu vurgu', () => {
  expect(colors).toMatchObject({ bg: '#F6F8FA', card: '#FFFFFF', primary: '#0B3B5C', accent: '#F2652B', text: '#0E1B26', muted: '#556270' });
  expect(radius).toMatchObject({ card: 20, button: 14, chip: 999 });
  expect(fontFamilies).toEqual({ heading: 'Bricolage Grotesque', body: 'Figtree' });
});

test('web için CSS değişkenleri üretilir', () => {
  const css = cssVariables();
  expect(css).toContain('--c-bg:#F6F8FA');
  expect(css).toContain('--c-primary:#0B3B5C');
  expect(css).toContain('--c-accent-soft:#FFF1EA');
  expect(css).toContain('--r-card:20px');
  expect(css.startsWith(':root{')).toBe(true);
});

/** WCAG göreli parlaklık ve karşıtlık oranı. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('metin renkleri okunur (WCAG AA 4.5:1)', () => {
  for (const bg of [colors.bg, colors.card, colors.surface]) {
    expect(contrast(colors.text, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.muted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.primary, bg)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(colors.white, colors.primary)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.white, colors.danger)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.white, colors.success)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.accentText, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.warning, colors.card)).toBeGreaterThanOrEqual(4.5);
});
