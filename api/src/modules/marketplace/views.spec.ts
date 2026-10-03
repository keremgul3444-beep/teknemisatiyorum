import { captainTotal } from './views';

test('kaptan ücreti: haftanın altında günlük, 7 gün ve üstü başlayan her hafta', () => {
  expect(captainTotal({ dayRateEur: 300, weekRateEur: 1600 }, 3)).toBe(900);
  expect(captainTotal({ dayRateEur: 300, weekRateEur: 1600 }, 7)).toBe(1600);
  expect(captainTotal({ dayRateEur: 300, weekRateEur: 1600 }, 10)).toBe(3200);
  expect(captainTotal({ dayRateEur: 300, weekRateEur: null }, 7)).toBe(1800);
});
