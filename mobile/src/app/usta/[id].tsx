import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Header, NotFound, ProviderProfile, Screen } from '@/components';
import { useProvider } from '@/services';

export default function UstaDetay() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useProvider(id);
  if (!p || p.kind !== 'usta') return <NotFound />;
  return (
    <Screen footer={<Button title={t('usta.requestQuote')} onPress={() => router.push({ pathname: '/is/yeni', params: { kategori: p.categories[0], usta: p.id } })} />}>
      <Header title={t(`usta.cat.${p.categories[0]}`)} />
      <ProviderProfile p={p} />
    </Screen>
  );
}
