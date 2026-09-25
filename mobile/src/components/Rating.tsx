import { View } from 'react-native';
import { colors, space, fonts } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
      <Icon name="star" size={14} color={colors.warning} filled />
      <T variant="caption" style={{ fontFamily: fonts.bodyBold }}>{value.toFixed(1)}</T>
      {count !== undefined ? <T variant="caption" color={colors.muted}>({count})</T> : null}
    </View>
  );
}
