import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

export function LegalDraftNote() {
  const { t } = useTranslation();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, padding: space(3), backgroundColor: colors.card }}>
      <T variant="caption" color={colors.warning} style={{ fontFamily: fonts.bodyBold }}>{t('legal.draft')}</T>
    </View>
  );
}
