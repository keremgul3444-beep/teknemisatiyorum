import { ReactNode } from 'react';
import { ScrollView, View, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';

export function Screen({ children, scroll = true, padded = true, footer, style }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; footer?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const inner = { padding: padded ? space(5) : 0, paddingBottom: space(10), gap: space(4) };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, style]}>{children}</View>
      )}
      {footer ? (
        <View style={{ padding: space(4), gap: space(2), borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}
