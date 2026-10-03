import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, space } from '@/theme';
import { Card, EmptyState, Header, Icon, Screen, T } from '@/components';
import { actions, formatPrice, useAllProviders, useCaptainBookings, useJobs, type Currency } from '@/services';
import { useRemote } from '@/services/useRemote';
import { currentLang } from '@/i18n';

export default function Odemeler() {
  const { t } = useTranslation();
  const lang = currentLang();
  const providers = useAllProviders();
  const jobs = useJobs().filter((j) => j.paid);
  const caps = useCaptainBookings().filter((c) => c.paid);
  // Gerçek mod: emanet ödemelerin sunucudaki durumu (bekliyor, aktarıldı, iade edildi); tutar TL (kur çevrilmiş) + platform payı.
  const remote = useRemote(() => actions.myServicePayments()).data;
  const titleOf = (kind: string, id: string) =>
    kind === 'job' ? jobs.find((j) => j.id === id)?.title ?? t('services.usta')
      : providers.find((p) => p.id === caps.find((c) => c.id === id)?.captainId)?.name ?? t('services.captain');
  const rows: { id: string; title: string; amount: number; cur: Currency; released: boolean; refunded?: boolean }[] = remote ? remote.map((p) => ({
    id: p.id, title: titleOf(p.subjectKind, p.subjectId), amount: (p.amountKurus + p.feeKurus) / 100, cur: 'TRY' as Currency,
    released: p.status === 'released', refunded: p.status === 'refunded',
  })) : [
    ...jobs.map((j) => ({
      id: j.id, title: j.title, amount: j.offers.find((o) => o.id === j.acceptedOfferId)?.priceTRY ?? 0, cur: 'TRY' as Currency,
      released: j.status === 'tamam' || j.status === 'degerlendirildi',
    })),
    ...caps.map((c) => ({ id: c.id, title: providers.find((p) => p.id === c.captainId)?.name ?? '—', amount: c.totalEUR, cur: 'EUR' as Currency, released: false })),
  ];
  return (
    <Screen>
      <Header title={t('profile.payments')} />
      {rows.length === 0 ? <EmptyState icon="lock" title={t('mine.paymentsEmpty')} /> : rows.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <Icon name={r.released ? 'check' : r.refunded ? 'back' : 'lock'} size={20} color={r.released ? colors.success : r.refunded ? colors.muted : colors.primary} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{r.title}</T>
              <T variant="caption" color={r.released ? colors.success : r.refunded ? colors.muted : colors.primary} style={{ fontFamily: fonts.bodySemi }}>
                {r.released ? t('mine.released') : r.refunded ? t('mine.refunded') : t('mine.held')}
              </T>
            </View>
            <T variant="h3">{formatPrice(r.amount, r.cur, lang)}</T>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
