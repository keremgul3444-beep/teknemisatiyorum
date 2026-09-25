import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, Header, ListingCard, Screen, Segmented } from '@/components';
import { useListings, type ListingStatus } from '@/services';

export default function Ilanlarim() {
  const { t } = useTranslation();
  const mine = useListings().filter((l) => l.sellerId === 'me');
  const [tab, setTab] = useState<ListingStatus>(mine.some((l) => l.status === 'onay-bekliyor') ? 'onay-bekliyor' : 'yayinda');
  const list = mine.filter((l) => l.status === tab);
  return (
    <Screen>
      <Header title={t('profile.listings')} />
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'yayinda', label: t('mine.live') }, { key: 'onay-bekliyor', label: t('mine.pending') }, { key: 'satildi', label: t('mine.sold') },
      ]} />
      {list.length === 0 ? <EmptyState icon="anchor" title={t('mine.empty')} actionLabel={t('mine.post')} onAction={() => router.push('/ilan-ver')} />
        : list.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Screen>
  );
}
