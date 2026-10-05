import { versionAtLeast } from './app-version';

test('sürüm karşılaştırma', () => {
  expect(versionAtLeast('1.2.10', '1.2.9')).toBe(true);
  expect(versionAtLeast('1.2', '1.2.0')).toBe(true);
  expect(versionAtLeast('1.1.9', '1.2')).toBe(false);
  expect(versionAtLeast('2', '1.9.9')).toBe(true);
  expect(versionAtLeast('abc', '1.0.0')).toBe(false);
  expect(versionAtLeast('1.0.0', '')).toBe(true);
});
