import { ReactNode } from 'react';
import { Pressable, View, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, space } from '@/theme';

export function Card({ children, onPress, style, padded = true }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const base: ViewStyle = {
    backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line,
    padding: padded ? space(4) : 0, overflow: 'hidden', gap: space(2),
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>{children}</Pressable>;
}
