import { colors, fonts, radius, space } from '@/theme';
test('tema değerleri tasarım belgesiyle aynı ("Liman")', () => {
  expect(colors).toMatchObject({ bg: '#F6F8FA', card: '#FFFFFF', primary: '#0B3B5C', accent: '#F2652B', text: '#0E1B26', muted: '#556270' });
  expect(radius).toMatchObject({ card: 20, button: 14, chip: 999 });
  expect(fonts.heading).toBe('BricolageGrotesque_800ExtraBold');
  expect(fonts.body).toBe('Figtree_400Regular');
  expect(space(4)).toBe(16);
});
