import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space, fonts } from '@/theme';
import { formatPrice, type Listing } from '@/services';
import { currentLang } from '@/i18n';
import { Card } from './Card';
import { BoatImage } from './BoatImage';
import { Badge } from './Badge';
import { T } from './T';
import { Chip } from './Chip';

export function ListingCard({ listing: l, compact, width, missing }: { listing: Listing; compact?: boolean; width?: number; missing?: string }) {
  const { t } = useTranslation();
  return (
    <Card padded={false} onPress={() => router.push(`/ilan/${l.id}`)} style={width ? { width } : undefined}>
      <BoatImage seed={l.photoSeed} height={compact ? 110 : 150}>
        <View style={{ position: 'absolute', top: space(2.5), left: space(2.5), flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>
          {l.status === 'onay-bekliyor' ? <Badge kind="beklemede" onDark /> : l.badges.slice(0, compact ? 1 : 2).map((b) => <Badge key={b} kind={b} onDark />)}
        </View>
      </BoatImage>
      <View style={{ padding: space(3.5), gap: space(1) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
          <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{l.brand} {l.model} · {l.year}</T>
          <T variant="h3" color={colors.primary} style={{ fontFamily: fonts.heading }}>{formatPrice(l.price, l.currency, currentLang())}</T>
        </View>
        <T variant="caption" color={colors.muted} numberOfLines={1}>
          {l.lengthM.toLocaleString(currentLang())} m · {l.location} · {t(`boatType.${l.type}`)}
          {l.logbookCount > 0 ? ` · ${t('listing.logbookCount', { count: l.logbookCount })}` : ''}
        </T>
        {missing ? <Chip label={missing} tone="warning" /> : null}
      </View>
    </Card>
  );
}
