/** Bildirime dokununca gidilecek ekran (yoksa null: yalnızca okundu işaretlenir). */
export function notifTarget(key: string, params: Record<string, string> | null): string | null {
  const p = params ?? {};
  switch (key) {
    case 'notif.newMessage': return p.conversationId ? `/sohbet/${p.conversationId}` : null;
    case 'notif.priceDrop': return p.listingId ? `/ilan/${p.listingId}` : null;
    case 'notif.searchMatch': return p.listingId ? `/ilan/${p.listingId}` : '/aramalar';
    case 'notif.listingApproved': return p.listingId ? `/ilan/${p.listingId}` : null;
    case 'notif.listingRejected': return '/profil/ilanlarim';
    case 'notif.listingRemoved': return '/profil/ilanlarim';
    case 'notif.reportReady': return '/ekspertiz';
    case 'notif.brokerAdvanced': return '/broker';
    case 'notif.listingExpiring': case 'notif.listingExpired': return '/profil/ilanlarim';
    case 'notif.docApproved': case 'notif.docRejected':
      return p.kind === 'ruhsat' ? '/profil/ilanlarim' : p.kind === 'usta' || p.kind === 'kaptan' ? '/panel/hizmet' : '/profil';
    // 2. dalga: iş sahibi işi görür; usta ve kaptan hizmet paneline gider.
    case 'notif.newQuote': case 'notif.jobDelivered': case 'notif.autoReleased':
      return p.jobId ? `/is/${p.jobId}` : p.kind === 'job' && p.id ? `/is/${p.id}` : '/profil/islerim';
    case 'notif.newJob': case 'notif.quoteAccepted': case 'notif.servicePaid': case 'notif.paymentReleased':
    case 'notif.paymentDisputed': case 'notif.bookingRequested': return '/panel/hizmet';
    case 'notif.bookingDeclined': return '/profil/islerim';
    case 'notif.paymentRefunded': return '/profil/odemeler';
    default: return null;
  }
}
