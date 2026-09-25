import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { BoatImage, Button, Card, EmptyState, Header, Screen, T } from '@/components';
import { useBoats } from '@/services';

export default function Teknelerim() {
  const { t } = useTranslation();
  const boats = useBoats();
  return (
    <Screen footer={<Button icon="plus" title={t('logbook.add')} onPress={() => router.push('/tekne-ekle')} />}>
      <Header title={t('profile.boats')} />
      {boats.length === 0 ? <EmptyState icon="logbook" title={t('logbook.empty')} body={t('logbook.emptyBody')} /> : boats.map((b) => (
        <Card key={b.id} padded={false} onPress={() => router.push(`/teknelerim/${b.id}`)}>
          <BoatImage seed={b.photoSeed} height={120} />
          <View style={{ padding: space(4), gap: space(1) }}>
            <T variant="h3">{b.name}</T>
            <T variant="caption" color={colors.muted}>{b.brand} {b.model} · {b.year} · {b.lengthM} m</T>
            <T variant="caption" color={colors.primary}>{t('listing.logbookCount', { count: b.logbook.length })}</T>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
