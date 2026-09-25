import { Pressable, View, ActivityIndicator } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, small }: {
  title: string; onPress?: () => void; variant?: Variant; icon?: string; disabled?: boolean; loading?: boolean; small?: boolean;
}) {
  const bg = { primary: colors.primary, secondary: colors.surface, ghost: 'transparent', danger: colors.danger }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? colors.white : colors.primary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg, borderRadius: radius.button, opacity: off ? 0.45 : pressed ? 0.85 : 1,
        paddingVertical: small ? space(2) : space(3.5), paddingHorizontal: space(4),
        borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.line,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2) }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <T variant="bodySemi" color={fg} style={small ? { fontSize: 13, fontFamily: fonts.bodySemi } : undefined}>{title}</T>
      </View>
    </Pressable>
  );
}
