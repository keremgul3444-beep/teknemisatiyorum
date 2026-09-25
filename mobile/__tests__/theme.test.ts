import { colors, radius, space } from '@/theme';
test('tema değerleri tasarım belgesiyle aynı', () => {
  expect(colors).toMatchObject({ bg: '#F4EFE6', card: '#FFFCF6', primary: '#0F6E68', text: '#1D2B2A',
    muted: '#6B736B', surface: '#E7DFD0', line: '#E2D9C8', success: '#2E7D4F', warning: '#C98A1B', danger: '#B3261E' });
  expect(radius).toMatchObject({ card: 18, button: 12, chip: 14 });
  expect(space(4)).toBe(16);
});
