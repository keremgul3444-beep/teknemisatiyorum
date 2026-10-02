import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, EmptyState, Header, ListingCard, Screen, T } from '@/components';
import { useFavorites, useListings } from '@/services';
import { COMPARE_MAX } from '@/features/compare';

/** Favoriler; karşılaştırma kipinde 2–3 ilan seçilip yan yana görülür. */
export default function Favoriler() {
  const { t } = useTranslation();
  const favs = useFavorites();
  const list = useListings().filter((l) => favs.includes(l.id));
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < COMPARE_MAX ? [...p, id] : p));
  const compare = () => { router.push({ pathname: '/karsilastir', params: { ids: picked.join(',') } }); };
  return (
    <Screen footer={selecting ? (
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Button variant="ghost" title={t('common.cancel')} onPress={() => { setSelecting(false); setPicked([]); }} /></View>
        <View style={{ flex: 2 }}><Button title={t('compare.cta', { n: picked.length })} disabled={picked.length < 2} onPress={compare} /></View>
      </View>
    ) : undefined}>
      <Header title={t('profile.favorites')} right={list.length >= 2 && !selecting ? <Button small variant="secondary" icon="list" title={t('compare.title')} onPress={() => setSelecting(true)} /> : undefined} />
      {selecting ? <T variant="caption" color={colors.muted}>{t('compare.select', { max: COMPARE_MAX })}</T> : null}
      {list.length === 0 ? <EmptyState icon="heart" title={t('mine.favEmpty')} body={t('mine.favBody')} actionLabel={t('common.seeAll')} onAction={() => router.push('/ilanlar')} />
        : list.map((l) => (
          <ListingCard key={l.id} listing={l} selected={selecting ? picked.includes(l.id) : undefined} onPress={selecting ? () => toggle(l.id) : undefined} />
        ))}
    </Screen>
  );
}
