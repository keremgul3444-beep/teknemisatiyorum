import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { CheckRow } from './CheckRow';
import { T } from './T';

/** Ödeme öncesi onay: ön bilgilendirme formu ve mesafeli satış sözleşmesi (metinler /yasal/<belge>). */
export function PreinfoAccept({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View>
      <CheckRow label={t('payment.accept')} checked={checked} onToggle={onToggle} />
      <View style={{ flexDirection: 'row', gap: space(4), flexWrap: 'wrap', paddingLeft: space(8) }}>
        {(['preinfo', 'distanceSale'] as const).map((doc) => (
          <Pressable key={doc} accessibilityRole="link" onPress={() => router.push(`/yasal/${doc}`)}>
            <T variant="caption" color={colors.primary} style={{ textDecorationLine: 'underline' }}>
              {t(doc === 'preinfo' ? 'payment.preinfoLink' : 'payment.distanceLink')}
            </T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
