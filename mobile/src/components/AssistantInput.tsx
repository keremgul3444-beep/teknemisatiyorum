import { Pressable, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Icon } from './Icon';

/**
 * Akıllı Asistan kutusu ("Liman"): tek satır; solda işaret, sağda lacivert düğme.
 * Ana ekran, asistan ve hizmetler aynı kutuyu kullanır (tek görünüm).
 */
export function AssistantInput({ value, onChangeText, onSubmit, placeholder, label, buttonLabel, icon = 'search', autoFocus }: {
  value: string; onChangeText: (s: string) => void; onSubmit: () => void; placeholder: string;
  label: string; buttonLabel: string; icon?: string; autoFocus?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2.5), minHeight: 56, paddingLeft: space(4), paddingRight: space(1.5),
      borderRadius: radius.button + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <Icon name="sparkle" size={20} color={colors.primary} />
      <TextInput value={value} onChangeText={onChangeText} onSubmitEditing={onSubmit} placeholder={placeholder} placeholderTextColor={colors.muted}
        returnKeyType="search" accessibilityLabel={label} autoFocus={autoFocus}
        style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: space(3) }} />
      <Pressable onPress={onSubmit} accessibilityRole="button" accessibilityLabel={buttonLabel}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.button, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <Icon name={icon} size={20} color={colors.white} />
      </Pressable>
    </View>
  );
}
