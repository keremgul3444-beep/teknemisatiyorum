import { Pressable, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { T } from './T';

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.5), gap: space(3) }}>
      <T style={{ flex: 1 }}>{label}</T>
      <View style={{ width: 46, height: 28, borderRadius: radius.chip, padding: 3, backgroundColor: value ? colors.primary : colors.surface, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}
