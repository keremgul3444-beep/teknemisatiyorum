import { Pressable, View } from 'react-native';
import { colors, space } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export function MenuRow({ icon, label, onPress, right, danger }: { icon: string; label: string; onPress: () => void; right?: string; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <T style={{ flex: 1 }} color={danger ? colors.danger : colors.text}>{label}</T>
      {right ? <T variant="caption" color={colors.muted}>{right}</T> : null}
      <Icon name="chevron" size={16} color={colors.muted} />
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}
