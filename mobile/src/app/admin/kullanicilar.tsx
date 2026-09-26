import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, space } from '@/theme';
import { AdminPage, Card, Icon, T } from '@/components';
import { maskPhone } from '@tms/shared';
import { ADMIN_USERS } from '@/services';
import { useEffect, useState } from 'react';
import { useMode } from '@/services/mode';
import { api } from '@/services/api/instance';
import { attempt } from '@/services/errors';


type Row = { id: string; name: string | null; role: string; level: number; phone: string; joined: string };

export default function AdminKullanicilar() {
  const { t } = useTranslation();
  const mode = useMode((s) => s.mode);
  const [remote, setRemote] = useState<Row[] | null>(null);
  useEffect(() => {
    if (mode !== 'api') return;
    attempt(() => api.get<{ id: string; name: string | null; roles: string[]; verifyLevel: number; phone: string | null; createdAt: string }[]>('/admin/users'))
      .then((r) => r && setRemote(r.map((u) => ({
        id: u.id, name: u.name, level: u.verifyLevel, phone: u.phone ?? '—', joined: u.createdAt.slice(0, 10),
        role: u.roles.includes('admin') || u.roles.includes('moderator') ? 'yonetici' : 'bireysel',
      }))));
  }, [mode]);
  // Demo verisindeki telefonlar burada maskelenir; sunucu zaten maskeli gönderir.
  const rows: Row[] = mode === 'api' ? remote ?? [] : ADMIN_USERS.map((u) => ({ id: u.name, name: u.name, role: u.role, level: u.level, phone: maskPhone(u.phone), joined: u.joined }));
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
        {rows.map((u) => (
          <View key={u.id} style={{ flexDirection: 'row', padding: space(3), borderTopWidth: 1, borderColor: colors.line }}>
            <T variant="caption" style={{ flex: 2 }} numberOfLines={1}>{u.name}</T>
            <T variant="caption" style={{ flex: 1 }}>{t(`profile.role.${u.role}`)}</T>
            <T variant="caption" style={{ flex: 1 }}>{u.level}</T>
            <T variant="caption" style={{ flex: 1 }} numberOfLines={1}>{u.phone}</T>
            <T variant="caption" style={{ flex: 1 }}>{u.joined}</T>
          </View>
        ))}
      </Card>
    </AdminPage>
  );
}
