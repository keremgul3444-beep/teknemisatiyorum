import { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Redirect, Slot, router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Header, T, showDemoToast } from '@/components';
import { useSession } from '@/session/role';

export const ADMIN_PAGES = ['index', 'ilanlar', 'belgeler', 'broker', 'ekspertiz', 'kullanicilar', 'odemeler', 'kayitlar'] as const;

export default function AdminLayout() {
  const { t } = useTranslation();
  const role = useSession((s) => s.role);
  const path = usePathname();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  useEffect(() => { if (role !== 'yonetici') showDemoToast(t('admin.noAccess')); }, [role, t]);
  if (role !== 'yonetici') return <Redirect href="/profil" />;

  const current = path.replace(/^\/admin\/?/, '') || 'index';
  const nav = ADMIN_PAGES.map((p) => {
    const on = current === p;
    return (
      <Pressable key={p} onPress={() => router.replace(p === 'index' ? '/admin' : `/admin/${p}`)}
        style={{ paddingVertical: space(2.5), paddingHorizontal: space(3), borderRadius: radius.button, backgroundColor: on ? colors.primary : 'transparent' }}>
        <T variant="bodySemi" color={on ? colors.white : colors.text} style={{ fontFamily: fonts.bodySemi, fontSize: 14 }}>{t(`admin.nav.${p}`)}</T>
      </Pressable>
    );
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space(4), borderBottomWidth: 1, borderColor: colors.line }}>
        <Header title={t('admin.title')} />
      </View>
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {wide ? (
          <View style={{ width: 230, padding: space(3), gap: space(1), borderRightWidth: 1, borderColor: colors.line }}>{nav}</View>
        ) : (
          <View style={{ borderBottomWidth: 1, borderColor: colors.line }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: space(2), gap: space(1) }}>{nav}</ScrollView>
          </View>
        )}
        <View style={{ flex: 1 }}><Slot /></View>
      </View>
    </SafeAreaView>
  );
}
