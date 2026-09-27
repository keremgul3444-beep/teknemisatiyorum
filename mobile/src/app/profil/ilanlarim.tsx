import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, EmptyState, Header, ListingCard, Screen, Segmented, T } from '@/components';
import { isApiMode, useListings, type Listing, type ListingStatus } from '@/services';
import { daysLeft } from '@/features/promo';

export default function Ilanlarim() {
  const { t } = useTranslation();
  const mine = useListings().filter((l) => l.sellerId === 'me' || l.isMine);
  const [tab, setTab] = useState<ListingStatus>(mine.some((l) => l.status === 'onay-bekliyor') ? 'onay-bekliyor' : 'yayinda');
  const list = mine.filter((l) => l.status === tab);
  return (
    <Screen>
      <Header title={t('profile.listings')} />
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'yayinda', label: t('mine.live') }, { key: 'onay-bekliyor', label: t('mine.pending') }, { key: 'satildi', label: t('mine.sold') },
      ]} />
      {list.length === 0 ? <EmptyState icon="anchor" title={t('mine.empty')} actionLabel={t('mine.post')} onAction={() => router.push('/ilan-ver')} />
        : list.map((l) => (
          <View key={l.id} style={{ gap: space(2) }}>
            <ListingCard listing={l} />
            {l.status === 'yayinda' && isApiMode() ? <PromoRow listing={l} /> : null}
          </View>
        ))}
    </Screen>
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
      <Button small variant="secondary" icon="sparkle" title={t('promo.cta')} onPress={() => router.push(`/profil/one-cikar/${l.id}`)} />
    </View>
  );
}
