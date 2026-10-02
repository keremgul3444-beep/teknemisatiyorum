import { t, type Locale } from '@/i18n';
import type { ListingView } from '@/lib/types';

/** "Vitrin" / "Acil" (ücretli öne çıkarma) ve "Fiyat düştü" etiketleri. */
export function PromoBadges({ promo, priceDrop, locale }: { promo: ListingView['promo'] | undefined; priceDrop?: ListingView['priceDrop']; locale: Locale }) {
  if (!promo?.featured && !promo?.urgent && !priceDrop) return null;
  return (
    <span className="row" style={{ gap: 6 }}>
      {promo?.featured ? <span className="pill featured">{t(locale, 'promo.featured')}</span> : null}
      {promo?.urgent ? <span className="pill urgent">{t(locale, 'promo.urgent')}</span> : null}
      {priceDrop ? <span className="pill drop">{t(locale, 'promo.priceDrop')}</span> : null}
    </span>
  );
}
