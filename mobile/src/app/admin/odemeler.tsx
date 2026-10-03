import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, T } from '@/components';
import { actions, formatPrice, isApiMode, useCaptainBookings, useJobs } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';

/** Gerçek mod: emanet ödemeleri; bekleyen ödeme ekipçe iade edilir ya da hizmet verene aktarılır (anlaşmazlık). */
function ApiPayments() {
  const { t } = useTranslation();
  const lang = currentLang();
  const { data, reload } = useRemote(() => actions.adminServicePayments());
  const [confirm, setConfirm] = useState<string | null>(null);
  const color: Record<string, string> = { held: colors.primary, released: colors.success, refunded: colors.danger, failed: colors.muted };
  return (
    <AdminPage>
      {(data ?? []).length === 0 && data ? <T color={colors.muted}>{t('admin.empty')}</T> : null}
      {(data ?? []).map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <T variant="bodySemi">{t(p.subjectKind === 'job' ? 'services.usta' : 'services.captain')} · {p.providerName ?? '—'}</T>
              <T variant="caption" color={color[p.status] ?? colors.muted}>{t(`admin.payStatus.${p.status}`, { defaultValue: p.status })}</T>
            </View>
            <T variant="h3">{formatPrice((p.amountKurus + p.feeKurus) / 100, 'TRY', lang)}</T>
          </View>
          {p.status === 'held' ? (confirm === p.id ? (
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <View style={{ flex: 1 }}><Button small variant="danger" title={t('admin.refundYes')} onPress={async () => { await attempt(() => actions.adminRefundService(p.id)); setConfirm(null); reload(); }} /></View>
              <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setConfirm(null)} /></View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <View style={{ flex: 1 }}><Button small variant="ghost" title={t('admin.refund')} onPress={() => setConfirm(p.id)} /></View>
              <View style={{ flex: 1 }}><Button small variant="secondary" title={t('admin.releaseNow')} onPress={async () => { await attempt(() => actions.adminReleaseService(p.id)); reload(); }} /></View>
            </View>
          )) : null}
        </Card>
      ))}
    </AdminPage>
  );
}

export default function AdminOdemeler() {
  return isApiMode() ? <ApiPayments /> : <DemoPayments />;
}

function DemoPayments() {
  const { t } = useTranslation();
  const lang = currentLang();
  const jobs = useJobs().filter((j) => j.paid);
  const caps = useCaptainBookings().filter((c) => c.paid);
  const rows = [
    ...jobs.map((j) => ({ id: j.id, label: j.title, amount: formatPrice(j.offers.find((o) => o.id === j.acceptedOfferId)?.priceTRY ?? 0, 'TRY', lang), state: j.status === 'devam' || j.status === 'onay' ? 'held' : 'released' })),
    ...caps.map((c) => ({ id: c.id, label: `${t('services.captain')} · ${c.start}`, amount: formatPrice(c.totalEUR, 'EUR', lang), state: 'held' })),
    { id: 'r1', label: t('admin.refundSample'), amount: formatPrice(14000, 'TRY', lang), state: 'refund' },
  ];
  const color = { held: colors.primary, released: colors.success, refund: colors.danger } as Record<string, string>;
  return (
    <AdminPage>
      {rows.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <T variant="bodySemi">{r.label}</T>
              <T variant="caption" color={color[r.state]}>{t(`admin.${r.state}`)}</T>
            </View>
            <T variant="h3">{r.amount}</T>
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}
