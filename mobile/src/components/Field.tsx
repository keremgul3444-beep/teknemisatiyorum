import { TextInput, View, KeyboardTypeOptions } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, maxLength }: {
  label?: string; value: string; onChangeText: (s: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: KeyboardTypeOptions; maxLength?: number;
}) {
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? <T variant="label" color={colors.muted}>{label.toLocaleUpperCase('tr-TR')}</T> : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted}
        multiline={multiline} keyboardType={keyboardType} maxLength={maxLength}
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.button,
          padding: space(3), fontFamily: fonts.body, fontSize: 15, color: colors.text,
          minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center',
        }} />
    </View>
  );
}
