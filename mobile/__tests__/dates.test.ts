import { localDateString } from '@/features/dates';

test('yerel gece 01:30 bile olsa takvim günü aynı kalır (UTC kayması yok)', () => {
  expect(localDateString(new Date(2026, 9, 1, 1, 30))).toBe('2026-10-01');
  expect(localDateString(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
});
