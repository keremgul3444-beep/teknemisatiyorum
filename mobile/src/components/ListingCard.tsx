import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { formatPrice, type Listing } from '@/services';
import { currentLang } from '@/i18n';
import { BoatImage } from './BoatImage';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { T } from './T';
import { Chip } from './Chip';
import { PromoBadges } from './PromoBadges';

/**
 * İlan kartı ("Liman"): çerçevesiz; köşeleri yuvarlak fotoğraf, bilgi altında.
 * `disabled`: önizleme gibi henüz var olmayan ilanlarda karta dokunulmaz.
 */
export function ListingCard({ listing: l, compact, width, missing, disabled, onPress, selected }: {
  listing: Listing; compact?: boolean; width?: number; missing?: string; disabled?: boolean;
  /** Verilirse dokunma ilana gitmek yerine bunu çalıştırır (ör. karşılaştırma için seçim); `selected` seçili çerçevesi. */
  onPress?: () => void; selected?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Pressable disabled={disabled} onPress={onPress ?? (() => router.push(`/ilan/${l.id}`))} accessibilityRole={disabled ? undefined : onPress ? 'checkbox' : 'link'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      style={({ pressed }) => [{ gap: space(2.5), opacity: pressed ? 0.85 : 1 }, width ? { width } : null,
        selected === undefined ? null : { borderWidth: 2, borderColor: selected ? colors.primary : colors.line, borderRadius: radius.card + 2, padding: space(1.5) }]}>
      <BoatImage seed={l.photoSeed} height={compact ? 120 : 176} rounded={radius.card} uri={l.photoUrls?.[0]}>
        <View style={{ position: 'absolute', top: space(3), left: space(3), flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
          {l.status === 'onay-bekliyor' ? <Badge kind="beklemede" onDark /> : l.status === 'reddedildi' ? <Badge kind="reddedildi" onDark /> : l.status === 'kaldirildi' ? <Badge kind="kaldirildi" onDark /> : l.status === 'suresi-doldu' ? <Badge kind="suresidoldu" onDark /> : l.badges.slice(0, compact ? 1 : 2).map((b) => <Badge key={b} kind={b} onDark />)}
        </View>
        <View style={{ position: 'absolute', bottom: space(3), left: space(3) }}><PromoBadges promo={l.promo} priceDrop={l.priceDrop} /></View>
        {selected ? (
          <View style={{ position: 'absolute', top: space(3), right: space(3), width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={16} color={colors.white} />
          </View>
        ) : null}
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
