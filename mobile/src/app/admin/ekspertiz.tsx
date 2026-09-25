import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';
import { AdminPage, Card, EmptyState, T } from '@/components';
import { useExpertiseBookings, useExpertisePackages } from '@/services';

export default function AdminEkspertiz() {
  const { t } = useTranslation();
  const bookings = useExpertiseBookings();
  const pkgs = useExpertisePackages();
  return (
    <AdminPage>
      <Card>
        <T variant="h3">Jeanneau Sun Odyssey 349 · Kapsamlı</T>
        <T variant="caption" color={colors.muted}>2026-09-18 · Eksper Ahmet Yalçın · 82/100</T>
        <T variant="caption" color={colors.success}>✓ {t('admin.status.onaylandi')}</T>
      </Card>
      {bookings.length === 0 ? <EmptyState icon="clipboard" title={t('admin.noBookings')} /> : bookings.map((b) => (
        <Card key={b.id}>
          <View>
            <T variant="h3">{pkgs.find((p) => p.id === b.packageId)?.name}</T>
            <T variant="caption" color={colors.muted}>{b.date} · {t(`expertise.${b.slot}`)}</T>
            <T variant="caption" color={colors.warning}>{t('admin.reportPending')}</T>
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}
