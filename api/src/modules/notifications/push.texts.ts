/**
 * Telefona düşen bildirimin metni sunucuda yazılır (uygulama kapalıyken de okunur). Metinler uygulamanın
 * `notif.*` çevirileriyle aynı tutulur (mobile/src/i18n/{tr,en}.json).
 */
const TEXTS: Record<'tr' | 'en', Record<string, string>> = {
  tr: {
    'notif.newMessage': 'Yeni mesaj: {{title}}',
    'notif.searchMatch': 'Kayıtlı aramana yeni ilan: {{title}}',
    'notif.priceDrop': 'Favorindeki ilanın fiyatı düştü: {{title}}',
    'notif.listingApproved': 'İlanın yayında: {{title}}',
    'notif.listingRejected': 'İlanın reddedildi: {{title}}',
    'notif.listingRemoved': 'İlanın yayından kaldırıldı: {{title}}',
    'notif.listingExpiring': 'İlanının süresi {{days}} gün içinde doluyor: {{title}}',
    'notif.listingExpired': 'İlanının süresi doldu, yenileyebilirsin: {{title}}',
    'notif.newJob': 'Alanında yeni iş talebi: {{title}}',
    'notif.newQuote': 'İşine yeni teklif geldi: {{title}}',
    'notif.quoteAccepted': 'Teklifin kabul edildi: {{title}}',
    'notif.servicePaid': 'Ödeme emanete alındı; işe başlayabilirsin',
    'notif.paymentReleased': 'Ödemen hesabına aktarıldı: ₺{{amount}}',
    'notif.paymentRefunded': 'Ödemen iade edildi: ₺{{amount}}',
    'notif.bookingRequested': 'Yeni rezervasyon talebi: {{start}} · {{days}} gün',
    'notif.bookingDeclined': 'Kaptan rezervasyon talebini geri çevirdi',
    'notif.jobDelivered': 'Usta işi bitirdiğini bildirdi: {{title}}. {{days}} gün içinde onaylamaz ya da sorun bildirmezsen ödeme ustaya aktarılır.',
    'notif.paymentDisputed': 'Müşteri bir sorun bildirdi; ödeme ekip incelemesine alındı.',
    'notif.autoReleased': 'Süre dolduğu için emanetteki ödeme hizmet verene aktarıldı.',
    'notif.docApproved': 'Belgen onaylandı',
    'notif.docRejected': 'Belgen reddedildi',
    'notif.reportReady': 'Ekspertiz raporun hazır · {{score}}/100',
    'notif.brokerAdvanced': '{{boat}} broker dosyası {{step}}. adıma geçti',
    'notif.staffReport': 'Yeni şikâyet: {{title}}',
    'notif.staffDispute': 'Bir ödemede sorun bildirildi; karar bekliyor (₺{{amount}}).',
    'notif.providerSuspended': 'Hizmet profilin ekip tarafından durduruldu: {{name}}',
  },
  en: {
    'notif.newMessage': 'New message: {{title}}',
    'notif.searchMatch': 'New listing for your saved search: {{title}}',
    'notif.priceDrop': 'A favourite dropped its price: {{title}}',
    'notif.listingApproved': 'Your listing is live: {{title}}',
    'notif.listingRejected': 'Your listing was rejected: {{title}}',
    'notif.listingRemoved': 'Your listing was taken down: {{title}}',
    'notif.listingExpiring': 'Your listing expires in {{days}} days: {{title}}',
    'notif.listingExpired': 'Your listing expired, renew it anytime: {{title}}',
    'notif.newJob': 'New job in your field: {{title}}',
    'notif.newQuote': 'New quote for your job: {{title}}',
    'notif.quoteAccepted': 'Your quote was accepted: {{title}}',
    'notif.servicePaid': 'Payment is held in escrow; you can start',
    'notif.paymentReleased': 'Your payment was released: ₺{{amount}}',
    'notif.paymentRefunded': 'Your payment was refunded: ₺{{amount}}',
    'notif.bookingRequested': 'New booking request: {{start}} · {{days}} days',
    'notif.bookingDeclined': 'The captain declined your booking request',
    'notif.jobDelivered': 'The technician marked the job done: {{title}}. If you don’t confirm or report a problem within {{days}} days, the payment is released.',
    'notif.paymentDisputed': 'The customer reported a problem; the payment is under team review.',
    'notif.autoReleased': 'The held payment was released to the provider after the waiting period.',
    'notif.docApproved': 'Your document was approved',
    'notif.docRejected': 'Your document was rejected',
    'notif.reportReady': 'Your survey report is ready · {{score}}/100',
    'notif.brokerAdvanced': '{{boat}} broker case moved to step {{step}}',
    'notif.staffReport': 'New report: {{title}}',
    'notif.staffDispute': 'A payment was disputed and needs a decision (₺{{amount}}).',
    'notif.providerSuspended': 'Your service profile was paused by the team: {{name}}',
  },
};
const TITLE: Record<'tr' | 'en', string> = { tr: 'teknemisatıyorum', en: 'teknemisatıyorum' };

export function pushText(lang: string, key: string, params?: Record<string, string>) {
  const l: 'tr' | 'en' = lang === 'en' ? 'en' : 'tr';
  const tpl = TEXTS[l][key];
  if (!tpl) return null;
  return { title: TITLE[l], body: tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params?.[k] ?? '') };
}
