import '@/i18n';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { DemoToastHost } from '@/components';
import { useEffect } from 'react';
import { useMode } from '@/services/mode';
import { syncAll } from '@/services/api/sync';
import { attempt } from '@/services/errors';

export default function RootLayout() {
  const mode = useMode((s) => s.mode);
  useEffect(() => { if (mode === 'api') attempt(() => syncAll()); }, [mode]);
  const [loaded] = useFonts({ Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, BricolageGrotesque_600SemiBold, BricolageGrotesque_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <DemoToastHost />
    </SafeAreaProvider>
  );
}
