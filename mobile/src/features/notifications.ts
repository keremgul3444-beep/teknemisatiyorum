/** Bildirime dokununca gidilecek ekran (yoksa null: yalnızca okundu işaretlenir). */
export function notifTarget(key: string, params: Record<string, string> | null): string | null {
  const p = params ?? {};
  switch (key) {
    case 'notif.newMessage': return p.conversationId ? `/sohbet/${p.conversationId}` : null;
    case 'notif.priceDrop': return p.listingId ? `/ilan/${p.listingId}` : null;
    case 'notif.listingApproved': return p.listingId ? `/ilan/${p.listingId}` : null;
    case 'notif.listingRejected': return '/profil/ilanlarim';
    case 'notif.reportReady': return '/ekspertiz';
    case 'notif.brokerAdvanced': return '/broker';
    default: return null;
  }
}
