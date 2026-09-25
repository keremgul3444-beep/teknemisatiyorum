import { Pressable, View } from 'react-native';
import { colors, space, radius } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export function CheckRow({ label, checked, onToggle, hint }: { label: string; checked: boolean; onToggle: () => void; hint?: string }) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start', paddingVertical: space(1.5) }}>
      <View style={{ width: 22, height: 22, borderRadius: radius.sm / 1.5, borderWidth: 1.5, borderColor: checked ? colors.primary : colors.muted,
        backgroundColor: checked ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {checked ? <Icon name="check" size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {hint ? <T variant="caption" color={colors.muted}>{hint}</T> : null}
      </View>
    </Pressable>
  );
}
