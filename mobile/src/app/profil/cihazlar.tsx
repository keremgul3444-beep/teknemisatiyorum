import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Header, Icon, Screen, T, showDemoToast } from '@/components';
import { DEMO_DEVICES } from '@/services';


export default function Cihazlar() {
  const { t } = useTranslation();
  const [list, setList] = useState(DEMO_DEVICES);
  return (
    <Screen>
      <Header title={t('devices.title')} />
      {list.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="phone" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{d.name}</T>
              <T variant="caption" color={colors.muted}>{d.city} · {t(`devices.ago.${d.ago.unit}`, { count: d.ago.n })}</T>
            </View>
            {d.current ? <T variant="caption" color={colors.success}>{t('devices.current')}</T>
              : <Button small variant="ghost" title={t('devices.signOut')} onPress={() => { setList((l) => l.filter((x) => x.id !== d.id)); showDemoToast(t('devices.signedOut')); }} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
