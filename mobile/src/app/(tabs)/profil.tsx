import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Avatar, Button, Card, Chip, Divider, MenuRow, Screen, T } from '@/components';
import { useBoats, useFavorites, useJobs, useListings, useSavedSearches } from '@/services';
import { useSession } from '@/session/role';
import { actions } from '@/services';
import { attempt } from '@/services/errors';

export default function Profil() {
  const { t } = useTranslation();
  const s = useSession();
  const boats = useBoats().length;
  const mine = useListings().filter((l) => l.sellerId === 'me' || l.isMine).length;
  const favs = useFavorites().length;
  const saved = useSavedSearches().length;
  const jobs = useJobs().filter((j) => j.status !== 'degerlendirildi').length;
  const verifyTo = s.verifyLevel < 1 ? '/auth/login' : s.verifyLevel < 2 ? '/verify/identity' : '/verify/professional';

  return (
    <Screen>
      {s.loggedIn ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: space(4), alignItems: 'center' }}>
            <Avatar name={s.name} size={60} />
            <View style={{ flex: 1, gap: space(1) }}>
              <T variant="h2">{s.name}</T>
              <T variant="caption" color={colors.primary}>{t(`profile.level.${s.verifyLevel}`)}</T>
              <Chip label={t(`profile.role.${s.role}`)} />
            </View>
          </View>
          {s.verifyLevel < 3 ? <Button small variant="secondary" icon="shield" title={s.verifyLevel < 2 ? t('profile.completeVerify') : t('profile.becomePro')} onPress={() => router.push(verifyTo)} /> : null}
        </Card>
      ) : (
        <Card>
          <T variant="h2">{t('profile.guestTitle')}</T>
          <T color={colors.muted}>{t('profile.guestBody')}</T>
          <Button title={t('profile.login')} onPress={() => router.push('/auth/login')} />
        </Card>
      )}

      <Card>
        <MenuRow icon="bell" label={t('profile.notifications')} onPress={() => router.push('/profil/bildirimler')} />
        <Divider />
        <MenuRow icon="logbook" label={t('profile.boats')} right={String(boats)} onPress={() => router.push('/teknelerim')} />
        <Divider />
        <MenuRow icon="anchor" label={t('profile.listings')} right={String(mine)} onPress={() => router.push('/profil/ilanlarim')} />
        <Divider />
        <MenuRow icon="heart" label={t('profile.favorites')} right={String(favs)} onPress={() => router.push('/profil/favoriler')} />
        <Divider />
        <MenuRow icon="bell" label={t('profile.saved')} right={String(saved)} onPress={() => router.push('/aramalar')} />
        <Divider />
        <MenuRow icon="wrench" label={t('profile.jobs')} right={String(jobs)} onPress={() => router.push('/profil/islerim')} />
        <Divider />
        <MenuRow icon="lock" label={t('profile.payments')} onPress={() => router.push('/profil/odemeler')} />
      </Card>

      {s.role === 'usta' || s.role === 'kaptan' || s.role === 'kurumsal' || s.role === 'yonetici' ? (
        <Card>
          {s.role === 'usta' || s.role === 'kaptan' ? <MenuRow icon="briefcase" label={t('profile.servicePanel')} onPress={() => router.push('/panel/hizmet')} /> : null}
          {s.role === 'kurumsal' ? <MenuRow icon="users" label={t('profile.companyPanel')} onPress={() => router.push('/panel/kurumsal')} /> : null}
          {s.role === 'yonetici' ? <MenuRow icon="chart" label={t('profile.adminPanel')} onPress={() => router.push('/admin')} /> : null}
        </Card>
      ) : null}

      <Card>
        <MenuRow icon="settings" label={t('profile.settings')} onPress={() => router.push('/profil/ayarlar')} />
        {s.loggedIn ? (<><Divider /><MenuRow icon="x" label={t('profile.logout')} danger onPress={() => attempt(() => actions.logout())} /></>) : null}
      </Card>
    </Screen>
  );
}
