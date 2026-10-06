import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Card, EmptyState, Header, Icon, Screen, T } from '@/components';
import { actions, isApiMode } from '@/services';
import { currentLang } from '@/i18n';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { notifTarget } from '@/features/notifications';

/** Sunucunun gönderdiği bildirimler (ilan onayı, yeni mesaj, rapor hazır…). Demo modunda boş. */
export default function Bildirimler() {
  const { t } = useTranslation();
  const remote = useRemote(() => actions.notifications());
  const rows = remote.data ?? [];
  const loading = isApiMode() && remote.data === null;
  const fmt = new Intl.DateTimeFormat(currentLang() === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const open = (id: string, key: string, params: Record<string, string> | null) => attempt(async () => {
    await actions.readNotification(id);
    await remote.reload();
    const to = notifTarget(key, params);
    if (to) router.push(to as never);
  });
  return (
    <Screen>
      <Header title={t('notifs.title')} />
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: space(8) }} /> : rows.length === 0 ? <EmptyState icon="bell" title={t('notifs.empty')} /> : rows.map((n) => (
        <Pressable key={n.id} onPress={() => open(n.id, n.key, n.params)}>
          <Card>
            <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
              <Icon name="bell" size={18} color={n.readAt ? colors.muted : colors.primary} />
              <View style={{ flex: 1 }}>
                <T variant={n.readAt ? 'body' : 'bodySemi'}>{t(n.key, { ...(n.params ?? {}), defaultValue: n.key })}</T>
                <T variant="caption" color={colors.muted}>{fmt.format(new Date(n.createdAt))}</T>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
