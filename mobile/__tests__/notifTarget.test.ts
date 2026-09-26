import { notifTarget } from '@/features/notifications';

test('bildirim ilgili ekrana götürür', () => {
  expect(notifTarget('notif.newMessage', { conversationId: 'c1' })).toBe('/sohbet/c1');
  expect(notifTarget('notif.listingApproved', { listingId: 'l1' })).toBe('/ilan/l1');
  expect(notifTarget('notif.listingRejected', { listingId: 'l1' })).toBe('/profil/ilanlarim');
  expect(notifTarget('notif.reportReady', {})).toBe('/ekspertiz');
  expect(notifTarget('notif.docApproved', null)).toBeNull();
});
