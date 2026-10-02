import { TextInput, View, KeyboardTypeOptions } from 'react-native';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

// Etiketli metin kutusu: required etikete yıldız ekler (erişilebilir ad değişmez), error kutunun altında
// kırmızı uyarı, hint gri açıklama gösterir.
export function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, maxLength, required, error, hint }: {
  label?: string; value: string; onChangeText: (s: string) => void; placeholder?: string; multiline?: boolean;
  keyboardType?: KeyboardTypeOptions; maxLength?: number; required?: boolean; error?: string; hint?: string;
}) {
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? (
        <T variant="label" color={colors.muted}>
          {label.toLocaleUpperCase('tr-TR')}{required ? <T variant="label" color={colors.danger}> *</T> : null}
        </T>
      ) : null}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted}
        multiline={multiline} keyboardType={keyboardType} maxLength={maxLength} accessibilityLabel={label}
        aria-invalid={error ? true : undefined}
        style={{
          backgroundColor: colors.card, borderWidth: error ? 1.5 : 1, borderColor: error ? colors.danger : colors.line, borderRadius: radius.button,
          padding: space(3), fontFamily: fonts.body, fontSize: 15, color: colors.text,
          minHeight: multiline ? 96 : undefined, textAlignVertical: multiline ? 'top' : 'center',
        }} />
      {error ? <T variant="caption" color={colors.danger} accessibilityLiveRegion="polite">{error}</T>
        : hint ? <T variant="caption" color={colors.muted}>{hint}</T> : null}
    </View>
  );
}
