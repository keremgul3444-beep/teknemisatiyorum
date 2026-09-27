import { expect, test } from 'vitest';
import { readConsent, serializeConsent } from '../src/lib/consent';

test('izin çerezi okunur/yazılır; bozuk değer izin sayılmaz', () => {
  const c = { necessary: true as const, analytics: false, at: '2026-10-01T00:00:00.000Z' };
  expect(readConsent(serializeConsent(c))).toEqual(c);
  expect(readConsent(encodeURIComponent(serializeConsent(c)))).toEqual(c);
  expect(readConsent('bozuk')).toBeNull();
  expect(readConsent(undefined)).toBeNull();
  expect(readConsent(JSON.stringify({ necessary: true, analytics: 'evet', at: 'x' }))).toBeNull();
});
