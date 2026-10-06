import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';

/** Sunucudan ilk yükleme sürerken gösterilir; böylece ekran yükleme bitmeden boş liste mesajı vermez. */
export function Loading() {
  const { t } = useTranslation();
  return <ActivityIndicator color={colors.primary} style={{ marginTop: space(8) }} accessibilityLabel={t('common.loading')} />;
}
