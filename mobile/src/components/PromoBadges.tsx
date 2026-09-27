import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import type { Promo } from '@/services/types';
import { T } from './T';

/** İlan kartı ve detayında "Vitrin" / "Acil" etiketleri (ücretli öne çıkarma). */
export function PromoBadges({ promo }: { promo?: Promo }) {
  const { t } = useTranslation();
  if (!promo?.featured && !promo?.urgent) return null;
  const pill = (label: string, bg: string) => (
    <View key={label} style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(0.5) }}>
      <T variant="label" color={colors.white}>{label}</T>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: space(1.5) }}>
      {promo.featured ? pill(t('promo.featured'), colors.primary) : null}
      {promo.urgent ? pill(t('promo.urgent'), colors.danger) : null}
    </View>
  );
}
