import { agoOf } from '@/features/devices';

const now = new Date('2026-09-26T12:00:00Z');
test('bir günden yeni oturum "şimdi" sayılır', () => {
  expect(agoOf('2026-09-26T02:00:00Z', now)).toEqual({ unit: 'now', n: 0 });
});
test('iki haftadan eskisi hafta, arası gün olarak gösterilir', () => {
  expect(agoOf('2026-09-23T12:00:00Z', now)).toEqual({ unit: 'days', n: 3 });
  expect(agoOf('2026-09-05T12:00:00Z', now)).toEqual({ unit: 'weeks', n: 3 });
});
