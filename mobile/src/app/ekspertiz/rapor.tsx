import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, fonts } from '@/theme';
import { Button, Card, Header, Icon, Screen, T, showDemoToast } from '@/components';

type Level = 'good' | 'attention' | 'defect';
const SECTIONS: { k: string; level: Level }[] = [
  { k: 'hull', level: 'attention' }, { k: 'engine', level: 'good' }, { k: 'electric', level: 'attention' },
  { k: 'deck', level: 'attention' }, { k: 'docs', level: 'good' },
];
const LEVEL_COLOR: Record<Level, string> = { good: colors.success, attention: colors.warning, defect: colors.danger };

export default function Rapor() {
  const { t } = useTranslation();
  const score = 82;
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <Screen footer={<Button icon="doc" title={t('expertise.pdf')} onPress={() => showDemoToast()} />}>
      <Header title={t('expertise.reportTitle')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(4) }}>
          <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={100} height={100} style={{ position: 'absolute' }}>
              <Circle cx={50} cy={50} r={r} stroke={colors.surface} strokeWidth={9} fill="none" />
              <Circle cx={50} cy={50} r={r} stroke={colors.primary} strokeWidth={9} fill="none" strokeLinecap="round"
                strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 50 50)" />
            </Svg>
            <T variant="h1" style={{ fontSize: 26 }}>{score}</T>
          </View>
          <View style={{ flex: 1, gap: space(1) }}>
            <T variant="label" color={colors.muted}>{t('expertise.score').toLocaleUpperCase('tr-TR')}</T>
            <T variant="h3">{t('expertise.reportBoat')}</T>
            <T variant="caption" color={colors.muted}>{t('expertise.reportMeta', { date: '2026-09-18' })}</T>
          </View>
        </View>
      </Card>
      {SECTIONS.map((s) => (
        <Card key={s.k}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="h3">{t(`expertise.sections.${s.k}`)}</T>
            <View style={{ backgroundColor: LEVEL_COLOR[s.level], borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(0.5) }}>
              <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{t(`expertise.${s.level}`)}</T>
            </View>
          </View>
          {[1, 2].map((n) => (
            <View key={n} style={{ flexDirection: 'row', gap: space(2) }}>
              <T color={colors.muted}>•</T><T variant="caption" style={{ flex: 1 }}>{t(`expertise.items.${s.k}${n}`)}</T>
            </View>
          ))}
          <View style={{ height: 70, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space(2) }}>
            <Icon name="camera" size={18} color={colors.muted} /><T variant="caption" color={colors.muted}>{t('expertise.photo')}</T>
          </View>
        </Card>
      ))}
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Icon name="logbook" size={18} color={colors.primary} />
        <T variant="caption" color={colors.primary}>{t('expertise.addedToLogbook')}</T>
      </View>
    </Screen>
  );
}
