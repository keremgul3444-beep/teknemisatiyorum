import '@/i18n';
import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { DemoToastHost, UpdateRequired } from '@/components';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useMode } from '@/services/mode';
import { syncAll } from '@/services/api/sync';
import { actions } from '@/services';
import { attempt } from '@/services/errors';
import { installForegroundHandler, routeOfResponse } from '@/features/push';
import { useUpgrade } from '@/features/upgrade';

installForegroundHandler();

export default function RootLayout() {
  const mode = useMode((s) => s.mode);
  const mustUpdate = useUpgrade((s) => s.required);
  useEffect(() => { if (mode === 'api') attempt(() => syncAll()).then(() => attempt(() => actions.registerPush())); }, [mode]);
  // Bildirime dokununca ilgili ekran (uygulama kapalıyken açıldıysa son yanıt da işlenir).
  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => { const to = routeOfResponse(r); if (to) router.push(to as never); };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  const [loaded] = useFonts({ Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (mustUpdate) return <SafeAreaProvider><UpdateRequired /></SafeAreaProvider>;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <DemoToastHost />
    </SafeAreaProvider>
  );
}
