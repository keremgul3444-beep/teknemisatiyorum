import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Card, EmptyState, Header, Icon, Screen, Segmented, T } from '@/components';
import { useAllProviders, useCaptainBookings, useExpertiseBookings, useExpertisePackages, useJobs } from '@/services';

export default function Islerim() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'jobs' | 'captains' | 'expertise'>('jobs');
  const jobs = useJobs();
  const caps = useCaptainBookings();
  const exps = useExpertiseBookings();
  const pkgs = useExpertisePackages();
  const providers = useAllProviders();

  const rows =
    tab === 'jobs' ? jobs.map((j) => ({ id: j.id, icon: 'wrench', title: j.title, sub: `${t(`usta.cat.${j.category}`)} · ${t(`job.steps.${j.status === 'degerlendirildi' ? 'tamam' : j.status}`)}`, go: () => router.push(`/is/${j.id}`) }))
      : tab === 'captains' ? caps.map((c) => ({ id: c.id, icon: 'compass', title: providers.find((p) => p.id === c.captainId)?.name ?? '—', sub: `${t('mine.captainRow', { start: c.start, count: c.days })} · ${c.paid ? t('mine.held') : t('mine.awaiting')}`, go: () => router.push(`/kaptan/${c.captainId}`) }))
        : exps.map((e) => ({ id: e.id, icon: 'clipboard', title: pkgs.find((p) => p.id === e.packageId)?.name ?? '—', sub: `${e.date} · ${t(`expertise.${e.slot}`)}`, go: () => router.push('/ekspertiz/rapor') }));

  return (
    <Screen>
      <Header title={t('profile.jobs')} />
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'jobs', label: t('mine.jobs') }, { key: 'captains', label: t('mine.captains') }, { key: 'expertise', label: t('mine.expertise') },
      ]} />
      {rows.length === 0 ? <EmptyState icon="calendar" title={t('mine.none')} /> : rows.map((r) => (
        <Card key={r.id} onPress={r.go}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name={r.icon} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{r.title}</T>
              <T variant="caption" color={colors.muted}>{r.sub}</T>
            </View>
            <Icon name="chevron" size={16} color={colors.muted} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
