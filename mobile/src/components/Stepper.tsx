import { View } from 'react-native';
import { colors, space } from '@/theme';
import { T } from './T';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(1) }}>
      {steps.map((s, i) => (
        <View key={s + i} style={{ flex: 1, gap: space(1) }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.primary : colors.surface }} />
          <T variant="caption" numberOfLines={1} color={i === current ? colors.primary : colors.muted} style={{ fontSize: 10 }}>{s}</T>
        </View>
      ))}
    </View>
  );
}
