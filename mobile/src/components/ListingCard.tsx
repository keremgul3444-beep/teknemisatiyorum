import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { formatPrice, type Listing } from '@/services';
import { currentLang } from '@/i18n';
import { BoatImage } from './BoatImage';
import { Badge } from './Badge';
import { T } from './T';
import { Chip } from './Chip';
import { PromoBadges } from './PromoBadges';

/**
 * İlan kartı ("Liman"): çerçevesiz; köşeleri yuvarlak fotoğraf, bilgi altında.
 * `disabled`: önizleme gibi henüz var olmayan ilanlarda karta dokunulmaz.
 */
export function ListingCard({ listing: l, compact, width, missing, disabled }: { listing: Listing; compact?: boolean; width?: number; missing?: string; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable disabled={disabled} onPress={() => router.push(`/ilan/${l.id}`)} accessibilityRole={disabled ? undefined : 'link'}
      style={({ pressed }) => [{ gap: space(2.5), opacity: pressed ? 0.85 : 1 }, width ? { width } : null]}>
      <BoatImage seed={l.photoSeed} height={compact ? 120 : 176} rounded={radius.card} uri={l.photoUrls?.[0]}>
        <View style={{ position: 'absolute', top: space(3), left: space(3), flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
          {l.status === 'onay-bekliyor' ? <Badge kind="beklemede" onDark /> : l.badges.slice(0, compact ? 1 : 2).map((b) => <Badge key={b} kind={b} onDark />)}
        </View>
        <View style={{ position: 'absolute', bottom: space(3), left: space(3) }}><PromoBadges promo={l.promo} /></View>
      </BoatImage>
      <View style={{ paddingHorizontal: space(0.5), gap: space(0.5) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
          <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{l.brand} {l.model} · {l.year}</T>
          <T variant="h3" color={colors.primary} style={{ fontFamily: fonts.bodyBold }}>{formatPrice(l.price, l.currency, currentLang())}</T>
        </View>
        <T variant="caption" color={colors.muted} numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
          {l.lengthM.toLocaleString(currentLang())} m · {l.location} · {t(`boatType.${l.type}`)}
          {l.logbookCount > 0 ? ` · ${t('listing.logbookCount', { count: l.logbookCount })}` : ''}
        </T>
        {missing ? <Chip label={missing} tone="warning" /> : null}
      </View>
    </Pressable>
  );
}
