import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Header, Icon, Screen, T, showDemoToast } from '@/components';
import { actions, DEMO_DEVICES } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { agoOf } from '@/features/devices';

type Row = { id: string; name: string; sub?: string; ago: { unit: string; n: number }; current: boolean };

/** Gerçek modda sunucudaki açık oturumlar; demo modunda örnek cihazlar. */
export default function Cihazlar() {
  const { t } = useTranslation();
  const [demo, setDemo] = useState(DEMO_DEVICES);
  const remote = useRemote(() => actions.sessions());
  const rows: Row[] = remote.data
    ? remote.data.map((s) => ({ id: s.id, name: s.deviceName, ago: agoOf(s.lastSeenAt), current: s.current }))
    : demo.map((d) => ({ id: d.id, name: d.name, sub: d.city, ago: d.ago, current: d.current }));
  const signOut = (id: string) => attempt(async () => {
    if (remote.data) { await actions.revokeSession(id); await remote.reload(); } else setDemo((l) => l.filter((x) => x.id !== id));
    showDemoToast(t('devices.signedOut'));
  });
  return (
    <Screen>
      <Header title={t('devices.title')} />
      {rows.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name="phone" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{d.name}</T>
              <T variant="caption" color={colors.muted}>{d.sub ? `${d.sub} · ` : ''}{t(`devices.ago.${d.ago.unit}`, { count: d.ago.n })}</T>
            </View>
            {d.current ? <T variant="caption" color={colors.success}>{t('devices.current')}</T>
              : <Button small variant="ghost" title={t('devices.signOut')} onPress={() => signOut(d.id)} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
