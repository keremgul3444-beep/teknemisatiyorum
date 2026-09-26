import { useState } from 'react';
import { FlatList, View, useWindowDimensions, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import { BoatImage, Button, T } from '@/components';
import { useSession } from '@/session/role';

const PAGES = [{ k: 's1', seed: 0 }, { k: 's2', seed: 2 }, { k: 's3', seed: 5 }];

export default function Onboarding() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const finish = () => {
    useSession.getState().finishOnboarding();
    router.replace('/kesfet');
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable onPress={finish} style={{ alignSelf: 'flex-end', padding: space(5) }}>
        <T variant="bodySemi" color={colors.muted}>{t('onboarding.skip')}</T>
      </Pressable>
      <FlatList
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.k}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: space(6), gap: space(6), justifyContent: 'center' }}>
            <BoatImage seed={item.seed} height={260} rounded={24} />
            <View style={{ gap: space(3) }}>
              <T variant="h1">{t(`onboarding.${item.k}t`)}</T>
              <T color={colors.muted}>{t(`onboarding.${item.k}b`)}</T>
            </View>
          </View>
        )}
      />
      <View style={{ padding: space(6), gap: space(5) }}>
        <View style={{ flexDirection: 'row', gap: space(2), justifyContent: 'center' }}>
          {PAGES.map((p, i) => (
            <View key={p.k} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: radius.xs, backgroundColor: i === page ? colors.primary : colors.surface }} />
          ))}
        </View>
        <Button title={t('onboarding.start')} onPress={finish} />
      </View>
    </SafeAreaView>
  );
}
