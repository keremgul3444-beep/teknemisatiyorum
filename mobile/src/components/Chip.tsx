import { Pressable } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

export function Chip({ label, selected, onPress, tone = 'default' }: { label: string; selected?: boolean; onPress?: () => void; tone?: 'default' | 'warning' }) {
  const warn = tone === 'warning';
  const bg = selected ? colors.primary : warn ? colors.card : colors.surface;
  const fg = selected ? colors.white : warn ? colors.warning : colors.text;
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={{ backgroundColor: bg, borderRadius: radius.chip, paddingVertical: space(1.5), paddingHorizontal: space(3),
        borderWidth: warn ? 1 : 0, borderColor: colors.warning, alignSelf: 'flex-start' }}>
      <T variant="caption" color={fg} style={{ fontFamily: fonts.bodySemi }}>{label}</T>
    </Pressable>
  );
}
