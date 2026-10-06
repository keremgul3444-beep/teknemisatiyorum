import type { ParsedQuery } from '@tms/shared';

/**
 * Sitede bildirime tıklayınca gidilecek sayfa (yerel önek olmadan). Usta/kaptan işleri yalnızca uygulamada:
 * onlarda null döner, bildirim yalnızca metin olarak görünür.
 */
export function webNotifTarget(key: string, params: Record<string, string> | null): string | null {
  const p = params ?? {};
  switch (key) {
    case 'notif.newMessage': return p.conversationId ? `/hesabim/mesajlar/${p.conversationId}` : '/hesabim/mesajlar';
    case 'notif.priceDrop': case 'notif.searchMatch': case 'notif.listingApproved':
      return p.listingId ? `/ilan/${p.listingId}` : null;
    case 'notif.listingRejected': case 'notif.listingRemoved': case 'notif.listingExpiring': case 'notif.listingExpired':
      return '/hesabim/ilanlar';
    // Ruhsat ilana bağlı; kimlik ve usta/kaptan belgesi hesabın kendisine.
    case 'notif.docApproved': case 'notif.docRejected': return p.kind === 'ruhsat' ? '/hesabim/ilanlar' : '/hesabim';
    case 'notif.staffReport': return '/yonetim/bildirimler';
    case 'notif.staffDispute': return '/yonetim/odemeler';
    default: return null;
  }
}

const n = (v: number, locale: string) => v.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US');
const SYMBOL: Record<string, string> = { EUR: '€', USD: '$', TRY: '₺', GBP: '£' };

/** Kayıtlı arama için kısa özet: "Yelkenli · Bodrum · 10–14 m · 2015+ · ≤ €150.000". */
export function describeQuery(q: ParsedQuery, locale: string, types: Record<string, string>, any: string): string {
  const range = (lo: number | undefined, hi: number | undefined, unit = '') =>
    lo !== undefined && hi !== undefined ? `${n(lo, locale)}–${n(hi, locale)}${unit}` : lo !== undefined ? `≥ ${n(lo, locale)}${unit}` : hi !== undefined ? `≤ ${n(hi, locale)}${unit}` : null;
  const cur = SYMBOL[q.currency ?? 'TRY'] ?? '';
  const price = q.minPrice !== undefined || q.maxPrice !== undefined
    ? range(q.minPrice, q.maxPrice)?.replace(/(\d)/, `${cur}$1`) ?? null : null;
  const parts = [
    q.type ? types[q.type] ?? q.type : null,
    q.location ?? null,
    range(q.minLength, q.maxLength, ' m'),
    q.minYear !== undefined && q.maxYear !== undefined ? `${q.minYear}–${q.maxYear}` : q.minYear !== undefined ? `${q.minYear}+` : q.maxYear !== undefined ? `≤ ${q.maxYear}` : null,
    price,
  ].filter((x): x is string => !!x);
  return (parts.join(' · ') || any).slice(0, 300);
}
