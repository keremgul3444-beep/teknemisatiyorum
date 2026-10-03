import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, DisputeBox, EmptyState, Header, Icon, Screen, Segmented, T } from '@/components';
import { actions, isApiMode, useAllProviders, useCaptainBookings, useExpertiseBookings, useExpertisePackages, useJobs, type CaptainBooking } from '@/services';
import { attempt } from '@/services/errors';

export default function Islerim() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'jobs' | 'captains' | 'expertise'>('jobs');
  const jobs = useJobs();
  const caps = useCaptainBookings();
  const exps = useExpertiseBookings();
  const pkgs = useExpertisePackages();
  const providers = useAllProviders();
  useEffect(() => { attempt(() => actions.syncServices()); }, []);

  const rows: { id: string; icon: string; title: string; sub: string; go: () => void; booking?: CaptainBooking }[] =
    tab === 'jobs' ? jobs.map((j) => ({ id: j.id, icon: 'wrench', title: j.title, sub: `${t(`usta.cat.${j.category}`)} · ${t(`job.steps.${j.status === 'degerlendirildi' ? 'tamam' : j.status}`)}`, go: () => router.push(`/is/${j.id}`) }))
      : tab === 'captains' ? caps.map((c) => ({ id: c.id, icon: 'compass', title: providers.find((p) => p.id === c.captainId)?.name ?? '—', sub: `${t('mine.captainRow', { start: c.start, count: c.days })} · ${bookingState(c)}`, go: () => router.push(`/kaptan/${c.captainId}`), booking: c }))
        : exps.map((e) => ({ id: e.id, icon: 'clipboard', title: pkgs.find((p) => p.id === e.packageId)?.name ?? '—', sub: `${e.date} · ${t(`expertise.${e.slot}`)}`, go: () => router.push('/ekspertiz/rapor') }));

  function bookingState(c: CaptainBooking) {
    if (c.status === 'cancelled') return t('mine.bookingCancelled');
    if (c.status === 'done') return t('mine.released');
    return c.paid ? t('mine.held') : t('mine.awaiting');
  }

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
          {r.booking && isApiMode() ? <BookingActions b={r.booking} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

/** Kaptan rezervasyonu (gerçek mod): öde, başladıktan sonra tamamla (para kaptana geçer), değerlendir. */
function BookingActions({ b }: { b: CaptainBooking }) {
  const { t } = useTranslation();
  // Çizim sırasında saat okunmaz (saf bileşen): başlangıç günü bugünün takvim gününe göre karşılaştırılır, ilk çizimde sabitlenir.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const started = b.start <= today;
  if (b.status === 'requested') return <Button small icon="lock" title={t('mine.payBooking')} onPress={() => router.push({ pathname: '/odeme', params: { tur: 'kaptan', id: b.id } })} />;
  if (b.status === 'paid') {
    return (
      <View style={{ gap: space(2) }}>
        {b.autoReleaseAt && !b.disputed ? <T variant="caption" color={colors.muted}>{t('mine.autoRelease', { date: b.autoReleaseAt.slice(0, 10) })}</T> : null}
        {started ? <Button small icon="check" title={t('mine.completeBooking')} onPress={() => attempt(() => actions.completeBooking(b.id))} /> : null}
        <DisputeBox disputed={b.disputed} onSubmit={(note) => actions.disputeBooking(b.id, note)} />
      </View>
    );
  }
  if (b.status === 'done' && !b.reviewed) {
    return (
      <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
        {[5, 4, 3, 2, 1].map((n) => <Button key={n} small variant="ghost" title={'★'.repeat(n)} onPress={() => attempt(() => actions.rateBooking(b.id, n))} />)}
      </View>
    );
  }
  return null;
}
