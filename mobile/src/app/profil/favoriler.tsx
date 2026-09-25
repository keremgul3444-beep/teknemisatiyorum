import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, Header, ListingCard, Screen } from '@/components';
import { useFavorites, useListings } from '@/services';

export default function Favoriler() {
  const { t } = useTranslation();
  const favs = useFavorites();
  const list = useListings().filter((l) => favs.includes(l.id));
  return (
    <Screen>
      <Header title={t('profile.favorites')} />
      {list.length === 0 ? <EmptyState icon="heart" title={t('mine.favEmpty')} body={t('mine.favBody')} actionLabel={t('common.seeAll')} onAction={() => router.push('/ilanlar')} />
        : list.map((l) => <ListingCard key={l.id} listing={l} />)}
    </Screen>
  );
}
