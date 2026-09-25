import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { space } from '@/theme';
import { Chip, Header, ProviderCard, Screen } from '@/components';
import { USTA_CATEGORIES, useProviders, type UstaCategory } from '@/services';

export default function UstaList() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kategori?: string }>();
  const initial = USTA_CATEGORIES.includes(params.kategori as UstaCategory) ? (params.kategori as UstaCategory) : undefined;
  const [cat, setCat] = useState<UstaCategory | undefined>(initial);
  const [sort, setSort] = useState<'rating' | 'reviews'>('rating');
  const list = [...useProviders('usta', cat)].sort((a, b) => (sort === 'rating' ? b.rating - a.rating : b.reviewCount - a.reviewCount));

  return (
    <Screen>
      <Header title={t('usta.title')} subtitle={t('usta.count', { count: list.length })} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
        <Chip label={t('common.all')} selected={!cat} onPress={() => setCat(undefined)} />
        {USTA_CATEGORIES.map((c) => <Chip key={c} label={t(`usta.cat.${c}`)} selected={cat === c} onPress={() => setCat(c)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space(2) }}>
        <Chip label={t('usta.sortRating')} selected={sort === 'rating'} onPress={() => setSort('rating')} />
        <Chip label={t('usta.sortReviews')} selected={sort === 'reviews'} onPress={() => setSort('reviews')} />
      </View>
      {list.map((p) => <ProviderCard key={p.id} provider={p} />)}
    </Screen>
  );
}
