import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '@/theme';
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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        tabBarLabel: t(`tabs.${route.name}`),
        tabBarIcon: ({ color }) =>
          route.name === 'ekle' ? (
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Icon name="plus" size={22} color={colors.white} />
            </View>
          ) : (
            <View>
              <Icon name={TAB_ICONS[route.name]} size={22} color={String(color)} />
              {route.name === 'mesajlar' && unread ? (
                <View style={{ position: 'absolute', top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} />
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
