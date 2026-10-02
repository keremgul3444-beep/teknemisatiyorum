import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import type { Listing, Promo } from '@/services/types';
import { T } from './T';

/** İlan kartı ve detayındaki etiketler: vitrin, acil (ücretli öne çıkarma) ve fiyat düştü. */
export function PromoBadges({ promo, priceDrop }: { promo?: Promo; priceDrop?: Listing['priceDrop'] }) {
  const { t } = useTranslation();
  if (!promo?.featured && !promo?.urgent && !priceDrop) return null;
  const pill = (label: string, bg: string, fg: string) => (
    <View key={label} style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
      <T variant="caption" color={fg} style={{ fontFamily: fonts.bodyBold }}>{label}</T>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: space(1.5) }}>
      {promo?.featured ? pill(t('promo.featured'), colors.white, colors.primary) : null}
      {promo?.urgent ? pill(t('promo.urgent'), colors.accentSoft, colors.accentText) : null}
      {priceDrop ? pill(t('promo.priceDrop'), colors.success, colors.white) : null}
    </View>
  );
}
