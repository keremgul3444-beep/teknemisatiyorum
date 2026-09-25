import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors, space, fonts } from '@/theme';
import { T } from './T';

export function Section({ title, actionLabel, onAction, children }: { title: string; actionLabel?: string; onAction?: () => void; children?: ReactNode }) {
  return (
    <View style={{ gap: space(3) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T variant="h3">{title}</T>
        {actionLabel ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodySemi }}>{actionLabel} →</T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
