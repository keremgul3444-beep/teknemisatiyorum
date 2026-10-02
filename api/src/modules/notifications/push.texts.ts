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
    'notif.docApproved': 'Belgen onaylandı',
    'notif.docRejected': 'Belgen reddedildi',
    'notif.reportReady': 'Ekspertiz raporun hazır · {{score}}/100',
    'notif.brokerAdvanced': '{{boat}} broker dosyası {{step}}. adıma geçti',
  },
  en: {
    'notif.newMessage': 'New message: {{title}}',
    'notif.searchMatch': 'New listing for your saved search: {{title}}',
    'notif.priceDrop': 'A favourite dropped its price: {{title}}',
    'notif.listingApproved': 'Your listing is live: {{title}}',
    'notif.listingRejected': 'Your listing was rejected: {{title}}',
    'notif.listingRemoved': 'Your listing was taken down: {{title}}',
    'notif.docApproved': 'Your document was approved',
    'notif.docRejected': 'Your document was rejected',
    'notif.reportReady': 'Your survey report is ready · {{score}}/100',
    'notif.brokerAdvanced': '{{boat}} broker case moved to step {{step}}',
  },
};
const TITLE: Record<'tr' | 'en', string> = { tr: 'teknemisatıyorum', en: 'teknemisatıyorum' };

export function pushText(lang: string, key: string, params?: Record<string, string>) {
  const l: 'tr' | 'en' = lang === 'en' ? 'en' : 'tr';
  const tpl = TEXTS[l][key];
  if (!tpl) return null;
  return { title: TITLE[l], body: tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params?.[k] ?? '') };
}
