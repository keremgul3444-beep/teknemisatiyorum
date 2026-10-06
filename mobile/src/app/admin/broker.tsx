import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Button, Card, EmptyState, Loading, Stepper, T } from '@/components';
import { actions, formatPrice, useBrokerCases } from '@/services';
import { useRemote } from '@/services/useRemote';
import { attempt } from '@/services/errors';
import { currentLang } from '@/i18n';

type Row = { id: string; boatName: string; step: number; price: string; who?: string | null };

export default function AdminBroker() {
  const { t } = useTranslation();
  const local = useBrokerCases();
  const remote = useRemote(() => actions.adminBrokerCases());
  const rows: Row[] = remote.data
    ? remote.data.map((c) => ({ id: c.id, boatName: c.boatName, step: c.step, who: c.userName, price: formatPrice(c.askingPrice, c.currency as 'EUR', currentLang()) }))
    : local.map((c) => ({ id: c.id, boatName: c.boatName, step: c.step, price: formatPrice(c.askingEUR, 'EUR', currentLang()) }));
  const advance = (id: string) => attempt(async () => {
    if (remote.data) { await actions.adminAdvanceBroker(id); await remote.reload(); } else await actions.advanceBroker(id);
  });
  return (
    <AdminPage>
      {remote.loading ? <Loading /> : rows.length === 0 ? <EmptyState icon="check" title={t('admin.empty')} /> : rows.map((c) => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="h3">{c.boatName}</T>
            <T color={colors.primary}>{c.price}</T>
          </View>
          {c.who ? <T variant="caption" color={colors.muted}>{t('admin.by', { who: c.who })}</T> : null}
          <Stepper steps={[0, 1, 2, 3, 4].map((s) => t(`broker.steps.s${s}`))} current={c.step} />
          <View style={{ marginTop: space(1) }}>
            <Button small variant="secondary" title={t('admin.advance')} disabled={c.step >= 4} onPress={() => advance(c.id)} />
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}
