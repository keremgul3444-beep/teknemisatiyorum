import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Card, Icon, Screen, T } from '@/components';
import { requireLevel } from '@/session/role';

export default function Ekle() {
  const { t } = useTranslation();
  const items = [
    { icon: 'anchor', title: t('add.listing'), body: t('add.listingBody'), go: () => requireLevel(2) && router.push('/ilan-ver') },
    { icon: 'wrench', title: t('add.job'), body: t('add.jobBody'), go: () => router.push('/is/yeni') },
    { icon: 'logbook', title: t('add.boat'), body: t('add.boatBody'), go: () => requireLevel(1) && router.push('/tekne-ekle') },
  ];
  return (
    <Screen>
      <T variant="h1" style={{ marginTop: space(2) }}>{t('add.title')}</T>
      {items.map((i) => (
        <Card key={i.title} onPress={i.go} style={{ padding: space(5) }}>
          <View style={{ flexDirection: 'row', gap: space(4), alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={i.icon} size={26} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: space(1) }}>
              <T variant="h2">{i.title}</T>
              <T color={colors.muted}>{i.body}</T>
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
