import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, space } from '@/theme';
import { AdminPage, Card, T } from '@/components';
import { useAudit } from '@/services';

export default function AdminKayitlar() {
  const { t } = useTranslation();
  const audit = useAudit();
  return (
    <AdminPage>
      <Card padded={false}>
        <View style={{ flexDirection: 'row', padding: space(3), backgroundColor: colors.surface }}>
          <T variant="caption" style={{ flex: 1.2, fontFamily: fonts.bodyBold }}>{t('admin.when')}</T>
          <T variant="caption" style={{ flex: 1.2, fontFamily: fonts.bodyBold }}>{t('admin.who')}</T>
          <T variant="caption" style={{ flex: 2.5, fontFamily: fonts.bodyBold }}>{t('admin.what')}</T>
        </View>
        {audit.map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', padding: space(3), borderTopWidth: 1, borderColor: colors.line }}>
            <T variant="caption" style={{ flex: 1.2 }}>{a.at}</T>
            <T variant="caption" style={{ flex: 1.2 }} numberOfLines={1}>{a.who}</T>
            <T variant="caption" style={{ flex: 2.5 }}>{t(a.key, a.params)}</T>
          </View>
        ))}
      </Card>
    </AdminPage>
  );
}
