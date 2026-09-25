import { Text, TextProps } from 'react-native';
import { colors, type } from '@/theme';

type Variant = keyof typeof type;
export function T({ variant = 'body', color = colors.text, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[type[variant], { color }, style]} />;
}
