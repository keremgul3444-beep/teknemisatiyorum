import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Card, T } from '@/components';
import { formatPrice, useCaptainBookings, useJobs } from '@/services';
import { currentLang } from '@/i18n';

export default function AdminOdemeler() {
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
