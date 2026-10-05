import { Linking, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { useUpgrade } from '@/features/upgrade';
import { WEB_URL } from '@/services/mode';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './T';

/** Zorunlu güncelleme: sunucu bu sürümü artık kabul etmiyor; mağaza sayfası açılır (yoksa site). */
export function UpdateRequired() {
  const { t } = useTranslation();
  const { ios, android } = useUpgrade();
  const url = (Platform.OS === 'ios' ? ios : Platform.OS === 'android' ? android : undefined) ?? WEB_URL;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space(6), gap: space(4) }}>
      <Icon name="info" size={40} color={colors.primary} />
      <T variant="h2" style={{ textAlign: 'center' }}>{t('update.title')}</T>
      <T color={colors.muted} style={{ textAlign: 'center' }}>{t('update.body')}</T>
      <Button title={t('update.button')} onPress={() => void Linking.openURL(url)} />
    </View>
  );
}
