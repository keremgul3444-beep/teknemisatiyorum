import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, space } from '@/theme';
import { AdminPage, Card, Icon, T } from '@/components';
import { maskPhone } from '@tms/shared';
import { ADMIN_USERS } from '@/services';


export default function AdminKullanicilar() {
  const { t } = useTranslation();
  const cols = ['name', 'role', 'level', 'phone', 'joined'] as const;
  return (
    <AdminPage>
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Icon name="shield" size={16} color={colors.primary} />
        <T variant="caption" color={colors.muted}>{t('admin.masked')}</T>
      </View>
      <Card padded={false}>
        <View style={{ flexDirection: 'row', padding: space(3), backgroundColor: colors.surface }}>
          {cols.map((c) => <T key={c} variant="caption" style={{ flex: c === 'name' ? 2 : 1, fontFamily: fonts.bodyBold }}>{t(`admin.cols.${c}`)}</T>)}
        </View>
        {ADMIN_USERS.map((u) => (
          <View key={u.name} style={{ flexDirection: 'row', padding: space(3), borderTopWidth: 1, borderColor: colors.line }}>
            <T variant="caption" style={{ flex: 2 }} numberOfLines={1}>{u.name}</T>
            <T variant="caption" style={{ flex: 1 }}>{t(`profile.role.${u.role}`)}</T>
            <T variant="caption" style={{ flex: 1 }}>{u.level}</T>
            <T variant="caption" style={{ flex: 1 }} numberOfLines={1}>{maskPhone(u.phone)}</T>
            <T variant="caption" style={{ flex: 1 }}>{u.joined}</T>
          </View>
        ))}
      </Card>
    </AdminPage>
  );
}
