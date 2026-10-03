import { notifTarget } from '@/features/notifications';

test('bildirim ilgili ekrana götürür', () => {
  expect(notifTarget('notif.newMessage', { conversationId: 'c1' })).toBe('/sohbet/c1');
  expect(notifTarget('notif.listingApproved', { listingId: 'l1' })).toBe('/ilan/l1');
  expect(notifTarget('notif.listingRejected', { listingId: 'l1' })).toBe('/profil/ilanlarim');
  expect(notifTarget('notif.reportReady', {})).toBe('/ekspertiz');
  expect(notifTarget('notif.docApproved', null)).toBe('/profil');
  expect(notifTarget('notif.unknown', null)).toBeNull();
});

test('sunucunun gönderdiği her bildirim bir ekrana götürür', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []));
  const src = files(path.join(__dirname, '../../api/src/modules')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const keys = [...new Set([...src.matchAll(/push\([^,]+,\s*'(notif\.[a-zA-Z]+)'/g)].map((m) => m[1]))];
  expect(keys.length).toBeGreaterThan(10);
  const params = { listingId: 'l1', conversationId: 'c1', jobId: 'j1', bookingId: 'b1', kind: 'job', id: 'j1' };
  expect(keys.filter((k) => notifTarget(k, params) === null)).toEqual([]);
});
