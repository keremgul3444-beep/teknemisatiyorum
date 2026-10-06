import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, EmptyState, Field, Loading, StatusLine, T } from '@/components';
import { actions, useExpertiseBookings, useExpertisePackages } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';

type Row = { id: string; title: string; meta: string; who?: string | null; done: boolean; score: number | null };

/** Rapor puanı girişi (0–100); geçerli değilse gönderilmez. */
function ReportForm({ onSubmit }: { onSubmit: (score: number) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState('');
  const n = Number(v);
  const ok = v !== '' && Number.isInteger(n) && n >= 0 && n <= 100;
  return (
    <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}><Field label={t('admin.reportScore')} value={v} onChangeText={setV} keyboardType="number-pad" maxLength={3} placeholder="0–100" /></View>
      <Button small title={t('admin.reportComplete')} disabled={!ok} onPress={() => onSubmit(n)} />
    </View>
  );
}

export default function AdminEkspertiz() {
  const { t } = useTranslation();
  const bookings = useExpertiseBookings();
  const pkgs = useExpertisePackages();
  const remote = useRemote(() => actions.adminExpertise());
  const rows: Row[] = remote.data
    ? remote.data.map((b) => ({ id: b.id, title: b.packageName ?? '—', meta: `${b.date} · ${t(`expertise.${b.slot}`)}`, who: b.userName, done: b.reportStatus === 'done', score: b.score }))
    : bookings.map((b) => ({ id: b.id, title: pkgs.find((p) => p.id === b.packageId)?.name ?? '—', meta: `${b.date} · ${t(`expertise.${b.slot}`)}`, done: false, score: null }));
  const report = (id: string, score: number) => attempt(async () => { await actions.adminReport(id, score); await remote.reload(); });
  return (
    <AdminPage>
      {!remote.data ? (
        <Card>
          <T variant="h3">{t('expertise.reportBoat')}</T>
          <T variant="caption" color={colors.muted}>{t('expertise.reportMeta', { date: '2026-09-18' })} · 82/100</T>
          <StatusLine text={t('admin.status.onaylandi')} />
        </Card>
      ) : null}
      {remote.loading ? <Loading /> : rows.length === 0 ? <EmptyState icon="clipboard" title={t('admin.noBookings')} /> : rows.map((b) => (
        <Card key={b.id}>
          <T variant="h3">{b.title}</T>
          <T variant="caption" color={colors.muted}>{b.meta}</T>
          {b.who ? <T variant="caption" color={colors.muted}>{t('admin.by', { who: b.who })}</T> : null}
          {b.done ? <StatusLine text={t('admin.reportDone', { score: b.score ?? 0 })} />
            : <T variant="caption" color={colors.warning}>{t('admin.reportPending')}</T>}
          {!b.done && remote.data ? <ReportForm onSubmit={(s) => report(b.id, s)} /> : null}
        </Card>
      ))}
    </AdminPage>
  );
}
