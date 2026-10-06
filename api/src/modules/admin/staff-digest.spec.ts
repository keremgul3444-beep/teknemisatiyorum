import { StaffDigest } from './staff-digest';

/** Saat ve "bugün gönderildi mi" kuralı veritabanı taklidiyle sınanır. */
function make(sentToday: number, pending: number) {
  const pushed: unknown[] = [];
  const count = () => Promise.resolve(pending);
  const prisma = {
    notification: { count: () => Promise.resolve(sentToday) },
    listing: { count }, verificationRequest: { count }, listingReport: { count }, servicePayment: { count }, leadRequest: { count },
  };
  const d = new StaffDigest(prisma as never, { pushStaff: (...a: unknown[]) => { pushed.push(a); return Promise.resolve(); } } as never);
  return { d, pushed };
}

test('09.00 (İstanbul) öncesi gönderilmez; sonrasında günde bir kez ve yalnızca bekleyen iş varsa', async () => {
  const early = make(0, 3);
  expect(await early.d.run(new Date('2026-10-07T05:30:00Z'))).toBeNull(); // 08.30 İstanbul
  const ok = make(0, 3);
  expect(await ok.d.run(new Date('2026-10-07T06:30:00Z'))).toMatchObject({ listings: '3' });
  expect(ok.pushed).toHaveLength(1);
  expect(await make(1, 3).d.run(new Date('2026-10-07T06:30:00Z'))).toBeNull();
  expect(await make(0, 0).d.run(new Date('2026-10-07T06:30:00Z'))).toBeNull();
});
