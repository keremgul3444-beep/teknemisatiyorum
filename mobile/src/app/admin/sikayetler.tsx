import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { colors, fonts, space } from '@/theme';
import { AdminPage, Button, Card, Chip, EmptyState, Loading, T } from '@/components';
import { actions, formatPrice, type ReportGroup, type TakedownReason } from '@/services';
import { TAKEDOWN_REASONS } from '@tms/shared';
import { useRemote } from '@/services/useRemote';
import { useMode } from '@/services/mode';
import { useStore } from '@/services/store';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';

/** Yönetim · Bildirimler: alıcıların bildirdiği ilanlar; kaldır, yoksay ya da satıcıyı askıya al. */
export default function AdminSikayetler() {
  const { t } = useTranslation();
  const mode = useMode((s) => s.mode);
  const groups = useRemote(() => actions.adminReports());
  // Demo modunda kuyruk yerel depodan hesaplanır (bildirim ve ilan değişince yeniden çizilir).
  useStore((s) => s.reports);
  useStore((s) => s.listings);
  const rows = mode === 'api' ? groups.data ?? [] : useStore.getState().reportGroups();
  return (
    <AdminPage>
      {mode === 'api' && groups.loading ? <Loading /> : rows.length === 0 ? <EmptyState icon="check" title={t('admin.reportsEmpty')} />
        : rows.map((g) => <ReportCard key={g.listing.id} group={g} onDone={groups.reload} />)}
    </AdminPage>
  );
}

function ReportCard({ group: g, onDone }: { group: ReportGroup; onDone: () => Promise<unknown> | void }) {
  const { t } = useTranslation();
  const lang = currentLang();
  // Geri alınamayan işlemler (kaldırma, askıya alma) aynı kartta ikinci adımla onaylanır.
  const [mode, setMode] = useState<null | 'takedown' | 'suspend'>(null);
  const run = (fn: () => Promise<unknown>) => attempt(async () => { await fn(); setMode(null); await onDone(); });
  const owner = g.listing.owner;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <T variant="h3">{g.listing.title} · {g.listing.year}</T>
          <T variant="caption" color={colors.muted}>{formatPrice(g.listing.price, g.listing.currency, lang)} · {owner.name ?? '—'} · {t(owner.verifyLevel >= 2 ? 'admin.sellerVerified' : 'admin.sellerUnverified')}</T>
        </View>
        <T variant="caption" color={colors.danger} style={{ fontFamily: fonts.bodyBold }}>{t('admin.reportCount', { count: g.count })}</T>
      </View>
      <View style={{ gap: space(1.5) }}>
        {g.reports.map((r) => (
          <View key={r.id} style={{ gap: space(0.5) }}>
            <T variant="caption" style={{ fontFamily: fonts.bodySemi }}>{t(`report.reasons.${r.reason}`)} · {r.createdAt.slice(0, 10)}</T>
            {r.note ? <T variant="caption" color={colors.muted}>{r.note}</T> : null}
          </View>
        ))}
      </View>
      {g.listing.description ? <T variant="caption" color={colors.muted} numberOfLines={4}>{g.listing.description}</T> : null}
      <Button small variant="ghost" title={`${t('admin.openListing')} →`} onPress={() => router.push(`/ilan/${g.listing.id}`)} />
      {mode === 'takedown' ? (
        <View style={{ gap: space(2) }}>
          <T variant="caption" color={colors.muted}>{t('admin.takedownReason')}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
            {TAKEDOWN_REASONS.map((r) => (
              <Chip key={r} label={t(`admin.takedownReasons.${r}`)} onPress={() => run(() => actions.takedownListing(g.listing.id, r as Exclude<TakedownReason, 'account_suspended'>))} />
            ))}
          </View>
          <Button small variant="secondary" title={t('common.cancel')} onPress={() => setMode(null)} />
        </View>
      ) : mode === 'suspend' ? (
        <View style={{ gap: space(2) }}>
          <T variant="caption">{t('admin.suspendConfirm')}</T>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <View style={{ flex: 1 }}><Button small variant="secondary" title={t('common.cancel')} onPress={() => setMode(null)} /></View>
            <View style={{ flex: 1 }}><Button small variant="danger" title={t('admin.suspend')} onPress={() => run(() => actions.suspendUser(owner.id, t('admin.suspendReasonDefault')))} /></View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          <View style={{ flexGrow: 1 }}><Button small variant="ghost" title={t('admin.dismiss')} onPress={() => run(() => actions.dismissReports(g.listing.id))} /></View>
          <View style={{ flexGrow: 1 }}><Button small variant="danger" title={t('admin.takedown')} onPress={() => setMode('takedown')} /></View>
          {owner.suspended ? null : <View style={{ flexGrow: 1 }}><Button small variant="secondary" title={t('admin.suspend')} onPress={() => setMode('suspend')} /></View>}
        </View>
      )}
    </Card>
  );
}
