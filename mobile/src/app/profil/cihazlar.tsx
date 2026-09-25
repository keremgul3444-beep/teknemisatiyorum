import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Header, Icon, Screen, T, showDemoToast } from '@/components';

const DEVICES = [
  { id: 'd1', name: 'iPhone 15 · iOS', where: 'İstanbul · şimdi', current: true },
  { id: 'd2', name: 'Chrome · Windows', where: 'Bodrum · 2 gün önce', current: false },
  { id: 'd3', name: 'Samsung S23 · Android', where: 'Göcek · 3 hafta önce', current: false },
];

export default function Cihazlar() {
  const { t } = useTranslation();
  const [list, setList] = useState(DEVICES);
  return (
    <Screen>
      <Header title={t('devices.title')} />
      {list.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="phone" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{d.name}</T>
              <T variant="caption" color={colors.muted}>{d.where}</T>
            </View>
            {d.current ? <T variant="caption" color={colors.success}>{t('devices.current')}</T>
              : <Button small variant="ghost" title={t('devices.signOut')} onPress={() => { setList((l) => l.filter((x) => x.id !== d.id)); showDemoToast(t('devices.signedOut')); }} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
