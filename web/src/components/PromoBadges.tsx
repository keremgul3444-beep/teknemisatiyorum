import { t, type Locale } from '@/i18n';
import type { ListingView } from '@/lib/types';

/** "Vitrin" / "Acil" etiketleri (ücretli öne çıkarma). */
export function PromoBadges({ promo, locale }: { promo: ListingView['promo'] | undefined; locale: Locale }) {
  if (!promo?.featured && !promo?.urgent) return null;
  return (
    <span className="row" style={{ gap: 6 }}>
      {promo.featured ? <span className="pill featured">{t(locale, 'promo.featured')}</span> : null}
      {promo.urgent ? <span className="pill urgent">{t(locale, 'promo.urgent')}</span> : null}
    </span>
  );
}
