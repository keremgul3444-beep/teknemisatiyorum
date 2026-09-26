import { Pressable, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { T } from './T';

export function ToggleRow({ label, value, onChange, disabled, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <Pressable onPress={() => { if (!disabled) onChange(!value); }} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.5), gap: space(3), opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hint ? <T variant="caption" color={colors.muted}>{hint}</T> : null}
      </View>
      <View style={{ width: 46, height: 28, borderRadius: radius.chip, padding: 3, backgroundColor: value ? colors.primary : colors.surface, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}
