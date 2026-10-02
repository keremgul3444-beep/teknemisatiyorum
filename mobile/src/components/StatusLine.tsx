import { View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

/** Durum satırı: ikon + kısa metin (onaylandı, gönderildi, doğrulandı). Metin içine işaret konmaz; ikon kullanılır. */
export function StatusLine({ icon = 'check', color = colors.success, text }: { icon?: string; color?: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
      <Icon name={icon} size={14} color={color} />
      <T variant="caption" color={color} style={{ fontFamily: fonts.bodySemi }}>{text}</T>
    </View>
  );
}

/** Madde işareti: metin içine "•" yazmak yerine küçük nokta. */
export function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space(2) }}>
      <View style={{ width: 5, height: 5, borderRadius: radius.pill, backgroundColor: colors.muted, marginTop: 6 }} />
      <T variant="caption" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}
