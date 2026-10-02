import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors, space, fonts } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export function Section({ title, actionLabel, onAction, children }: { title: string; actionLabel?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="h2" style={{ fontSize: 19, lineHeight: 24 }}>{title}</T>
        {actionLabel ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space(0.5), minHeight: 44 }}>
            <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodySemi, fontSize: 14 }}>{actionLabel}</T>
            <Icon name="chevron" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
