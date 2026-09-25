import { View } from 'react-native';
import { colors } from '@/theme';
import { T } from './T';

export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toLocaleUpperCase('tr-TR');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <T variant="h3" color={colors.primary} style={{ fontSize: size * 0.36 }}>{initials}</T>
    </View>
  );
}
