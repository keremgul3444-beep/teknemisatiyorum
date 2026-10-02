import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar, Card, EmptyState, Screen, T } from '@/components';
import { useConversations } from '@/services';
import { useSession } from '@/session/role';

export default function Mesajlar() {
  const { t } = useTranslation();
  const loggedIn = useSession((s) => s.loggedIn);
  const convs = useConversations();
  return (
    <Screen>
      <T variant="h1" style={{ marginTop: space(2) }}>{t('messages.title')}</T>
      {!loggedIn ? (
        <EmptyState icon="mail" title={t('messages.loginTitle')} actionLabel={t('common.login')} onAction={() => router.push('/auth/login')} />
      ) : convs.length === 0 ? (
        <EmptyState icon="mail" title={t('messages.empty')} body={t('messages.emptyBody')} />
      ) : (
        convs.map((c) => {
          const last = c.messages.at(-1);
          return (
            <Card key={c.id} onPress={() => router.push(`/sohbet/${c.id}`)}>
              <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
                <Avatar name={c.withName.replace(/^Kaptan /, '')} />
                <View style={{ flex: 1, gap: space(0.5) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{c.withName}</T>
                    <T variant="caption" color={colors.muted}>{last?.at ?? ''}</T>
                  </View>
                  <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodySemi }} numberOfLines={1}>
                    {t(`messages.kind.${c.subject.kind}`)} · {c.subject.title}
                  </T>
                  <T variant="caption" color={c.unread ? colors.text : colors.muted} numberOfLines={1} style={c.unread ? { fontFamily: fonts.bodyBold } : undefined}>
                    {last?.text ?? c.preview ?? t('messages.noMessages')}
                  </T>
                </View>
                {c.unread ? <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.accent }} /> : null}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
