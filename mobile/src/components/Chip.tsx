import { Pressable } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

/** Hap biçimli seçim/öneri düğmesi; seçiliyken lacivert dolu. */
export function Chip({ label, selected, onPress, tone = 'default' }: { label: string; selected?: boolean; onPress?: () => void; tone?: 'default' | 'warning' }) {
  const warn = tone === 'warning';
  const bg = selected ? colors.primary : colors.card;
  const fg = selected ? colors.white : warn ? colors.warning : colors.text;
  const border = selected ? colors.primary : warn ? colors.warning : colors.line;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={({ pressed }) => ({ backgroundColor: bg, borderRadius: radius.chip, minHeight: 36, justifyContent: 'center', paddingHorizontal: space(3.5),
        borderWidth: 1, borderColor: border, alignSelf: 'flex-start', opacity: pressed ? 0.8 : 1 })}>
      <T variant="caption" color={fg} style={{ fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18 }}>{label}</T>
    </Pressable>
  );
}
