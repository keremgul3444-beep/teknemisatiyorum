import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, radius, space } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/kesfet');
}

export function Header({ title, back = true, right, subtitle }: { title: string; back?: boolean; right?: ReactNode; subtitle?: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
      {back ? (
        <Pressable accessibilityLabel={t('common.back')} hitSlop={12} onPress={goBack}
          style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
          <Icon name="back" size={20} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T variant="h2" numberOfLines={1}>{title}</T>
        {subtitle ? <T variant="caption" color={colors.muted}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
