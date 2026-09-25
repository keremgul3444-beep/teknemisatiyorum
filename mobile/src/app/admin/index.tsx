import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AdminPage, Card, Section, T } from '@/components';
import { formatPrice, useAdminItems, useAudit, useBrokerCases, useJobs, useListings } from '@/services';
import { currentLang } from '@/i18n';

export default function AdminHome() {
  const { t } = useTranslation();
  const listings = useListings();
  const pending = useAdminItems().filter((a) => a.status === 'bekliyor').length;
  const jobs = useJobs().filter((j) => j.status !== 'degerlendirildi').length;
  const broker = useBrokerCases().filter((c) => c.step < 4).length;
  const audit = useAudit().slice(0, 5);
  const kpis: [string, string][] = [
    ['active', String(listings.filter((l) => l.status === 'yayinda').length)], ['pending', String(pending)], ['jobs', String(jobs)],
    ['volume', formatPrice(1284000, 'TRY', currentLang())], ['users', '146'], ['broker', String(broker)],
  ];
  return (
    <AdminPage>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        {kpis.map(([k, v]) => (
          <Card key={k} style={{ minWidth: 150, flexGrow: 1, flexBasis: '45%' }}>
            <T variant="caption" color={colors.muted}>{t(`admin.kpi.${k}`)}</T>
            <T variant="h1" color={colors.primary} style={{ fontSize: 24 }}>{v}</T>
          </Card>
        ))}
      </View>
      <Section title={t('admin.recent')}>
        <Card>
          {audit.map((a) => (
            <View key={a.id} style={{ paddingVertical: space(1.5), borderBottomWidth: 1, borderColor: colors.line }}>
              <T variant="bodySemi">{a.action}</T>
              <T variant="caption" color={colors.muted}>{a.at} · {a.who}</T>
            </View>
          ))}
        </Card>
      </Section>
    </AdminPage>
  );
}
