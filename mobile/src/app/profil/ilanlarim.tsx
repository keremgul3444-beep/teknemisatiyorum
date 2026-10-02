import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, EmptyState, Header, Icon, ListingCard, Screen, Segmented, T } from '@/components';
import { isApiMode, useListings, type Listing, type ListingStatus } from '@/services';
import { daysLeft } from '@/features/promo';

export default function Ilanlarim() {
  const { t } = useTranslation();
  const mine = useListings().filter((l) => l.sellerId === 'me' || l.isMine);
  // Önce satıcının ilgilenmesi gereken durum açılır: reddedilen, sonra onay bekleyen.
  const [tab, setTab] = useState<ListingStatus>(mine.some((l) => l.status === 'reddedildi') ? 'reddedildi'
    : mine.some((l) => l.status === 'onay-bekliyor') ? 'onay-bekliyor' : 'yayinda');
  const list = mine.filter((l) => l.status === tab);
  return (
    <Screen>
      <Header title={t('profile.listings')} />
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'yayinda', label: t('mine.live') }, { key: 'onay-bekliyor', label: t('mine.pending') },
        ...(mine.some((l) => l.status === 'reddedildi') ? [{ key: 'reddedildi' as const, label: t('mine.rejected') }] : []),
        ...(mine.some((l) => l.status === 'kaldirildi') ? [{ key: 'kaldirildi' as const, label: t('mine.removed') }] : []),
        { key: 'satildi', label: t('mine.sold') },
      ]} />
      {list.length === 0 ? <EmptyState icon="anchor" title={t('mine.empty')} actionLabel={t('mine.post')} onAction={() => router.push('/ilan-ver')} />
        : list.map((l) => (
          <View key={l.id} style={{ gap: space(2) }}>
            <ListingCard listing={l} />
            {l.status === 'reddedildi' ? <T variant="caption" color={colors.danger}>{t(`mine.rejectReasons.${l.rejectReason ?? 'rules'}`)}</T> : null}
            {l.status === 'kaldirildi' && l.removedReason ? <T variant="caption" color={colors.danger}>{t(`mine.removedReasons.${l.removedReason}`)}</T> : null}
            {l.stats ? <StatsRow stats={l.stats} /> : null}
            {l.status === 'yayinda' && isApiMode() ? <PromoRow listing={l} /> : null}
          </View>
        ))}
    </Screen>
  );
}

/** Satıcı istatistikleri: görüntülenme, favori, mesaj. */
function StatsRow({ stats }: { stats: NonNullable<Listing['stats']> }) {
  const { t } = useTranslation();
  const items: [string, string][] = [['eye', t('mine.views', { n: stats.views })], ['heart', t('mine.favorites', { n: stats.favorites })], ['mail', t('mine.messages', { n: stats.messages })]];
  return (
    <View style={{ flexDirection: 'row', gap: space(4), flexWrap: 'wrap' }}>
      {items.map(([icon, label]) => (
        <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
          <Icon name={icon} size={16} color={colors.muted} />
          <T variant="caption" color={colors.muted}>{label}</T>
        </View>
      ))}
    </View>
  );
}

/** Yayındaki ilanın öne çıkarma durumu (kalan gün) ve öne çıkarma düğmesi. */
function PromoRow({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation();
  const f = daysLeft(l.promo?.featuredUntil);
  const u = daysLeft(l.promo?.urgentUntil);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) }}>
      <View style={{ flex: 1 }}>
        {f ? <T variant="caption" color={colors.primary}>{t('promo.activeFeatured', { n: f })}</T> : null}
        {u ? <T variant="caption" color={colors.danger}>{t('promo.activeUrgent', { n: u })}</T> : null}
      </View>
      <Button small variant="ghost" icon="doc" title={t('mine.transfer')} onPress={() => router.push({ pathname: '/devir', params: { ilan: l.id } })} />
      <Button small variant="secondary" icon="sparkle" title={t('promo.cta')} onPress={() => router.push(`/profil/one-cikar/${l.id}`)} />
    </View>
  );
}
