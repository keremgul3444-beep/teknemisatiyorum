import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius } from '@/theme';
import { Icon } from '@/components';
import { useConversations } from '@/services';

const TAB_ICONS: Record<string, string> = { kesfet: 'home', hizmetler: 'wrench', ekle: 'plus', mesajlar: 'mail', profil: 'user' };

export default function TabsLayout() {
  const { t } = useTranslation();
  const unread = useConversations().some((c) => c.unread);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 68, paddingTop: 8 },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        // Ortadaki "İlan ver" düğmesi yazısız (büyük düğme yazının üstüne biner); ekran okuyucu adını yine okur.
        tabBarLabel: route.name === 'ekle' ? () => null : t(`tabs.${route.name}`),
        tabBarAccessibilityLabel: t(`tabs.${route.name}`),
        tabBarIcon: ({ color }) =>
          // "İlan ver" her zaman görünür ve ayrışır: turuncu, büyük düğme.
          route.name === 'ekle' ? (
            <View style={{ width: 48, height: 48, marginTop: 4, borderRadius: radius.button + 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 10px ${colors.accent}59` }}>
              <Icon name="plus" size={24} color={colors.white} />
            </View>
          ) : (
            <View>
              <Icon name={TAB_ICONS[route.name]} size={22} color={String(color)} />
              {route.name === 'mesajlar' && unread ? (
                <View style={{ position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: radius.xs, backgroundColor: colors.danger }} />
              ) : null}
            </View>
          ),
      })}>
      <Tabs.Screen name="kesfet" />
      <Tabs.Screen name="hizmetler" />
      <Tabs.Screen name="ekle" />
      <Tabs.Screen name="mesajlar" />
      <Tabs.Screen name="profil" />
    </Tabs>
  );
}
