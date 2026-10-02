import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';
import { Icon } from './Icon';

export type BadgeName = 'ekspertizli' | 'sahiplik' | 'broker' | 'belge' | 'dogrulanmis' | 'beklemede' | 'reddedildi' | 'kaldirildi';

/** Güven rozeti ("Liman"): hap biçimli; fotoğraf üstünde beyaz, sayfada çerçeveli. Bekleyen: turuncu nokta. */
export function Badge({ kind, onDark }: { kind: BadgeName; onDark?: boolean }) {
  const { t } = useTranslation();
  // Bekleyen turuncu, reddedilen kırmızı noktayla; diğerleri onay işaretiyle.
  const dot = kind === 'beklemede' ? colors.warning : kind === 'reddedildi' || kind === 'kaldirildi' ? colors.danger : null;
  const pending = dot !== null;
  const fg = dot ?? (onDark ? colors.primary : colors.text);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: space(1),
      backgroundColor: onDark ? colors.white : pending ? colors.surface : colors.card,
      borderWidth: onDark ? 0 : 1, borderColor: colors.line, borderRadius: radius.pill,
      paddingHorizontal: space(2.5), paddingVertical: space(1), alignSelf: 'flex-start',
    }}>
      {pending
        ? <View style={{ width: 6, height: 6, borderRadius: radius.pill, backgroundColor: dot }} />
        : <Icon name="check" size={12} color={fg} />}
      <T variant="caption" color={fg} style={{ fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 }}>{t(`badge.${kind}`)}</T>
    </View>
  );
}
