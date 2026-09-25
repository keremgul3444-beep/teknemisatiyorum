import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { T } from './T';

export type BadgeName = 'ekspertizli' | 'sahiplik' | 'broker' | 'dogrulanmis' | 'beklemede';
export function Badge({ kind, onDark }: { kind: BadgeName; onDark?: boolean }) {
  const { t } = useTranslation();
  const pending = kind === 'beklemede';
  return (
    <View style={{
      backgroundColor: onDark ? colors.white : pending ? colors.surface : colors.card, opacity: onDark ? 0.95 : 1,
      borderWidth: onDark ? 0 : 1, borderColor: colors.line, borderRadius: radius.sm,
      paddingHorizontal: space(2), paddingVertical: space(1), alignSelf: 'flex-start',
    }}>
      <T variant="caption" color={pending ? colors.warning : colors.text} style={{ fontFamily: fonts.bodyBold, fontSize: 11 }}>
        {pending ? '• ' : '✓ '}{t(`badge.${kind}`)}
      </T>
    </View>
  );
}
