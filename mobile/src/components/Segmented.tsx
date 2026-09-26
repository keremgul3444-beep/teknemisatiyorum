import { Pressable, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { T } from './T';

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.button, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)}
          style={{ flex: 1, paddingVertical: space(2.5), borderRadius: radius.button - 2, backgroundColor: value === o.key ? colors.card : 'transparent', alignItems: 'center' }}>
          <T variant="caption" color={value === o.key ? colors.primary : colors.muted} style={{ fontFamily: fonts.bodyBold }}>{o.label}</T>
        </Pressable>
      ))}
    </View>
  );
}
