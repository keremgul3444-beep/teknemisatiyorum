import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import type { Provider } from '@/services';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Card } from './Card';
import { Icon } from './Icon';
import { Rating } from './Rating';
import { Section } from './Section';
import { T } from './T';

/** Usta, kaptan ve eksper profillerinin ortak üst kısmı: kimlik, belgeler, hakkında, yorumlar. */
export function ProviderProfile({ p }: { p: Provider }) {
  const { t } = useTranslation();
  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', gap: space(4), alignItems: 'center' }}>
          <Avatar name={p.name.replace(/^(Kaptan|Eksper) /, '')} size={64} />
          <View style={{ flex: 1, gap: space(1) }}>
            <T variant="h2">{p.name}</T>
            <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
              <Rating value={p.rating} count={p.reviewCount} />
              <T variant="caption" color={colors.muted}>{p.region}</T>
            </View>
            <T variant="caption" color={colors.muted}>{t('usta.experience', { n: p.yearsExp })}</T>
          </View>
        </View>
        <Badge kind={p.verified ? 'dogrulanmis' : 'beklemede'} />
      </Card>
      <Section title={t('usta.docs')}>
        <Card>
          {p.docs.map((d) => (
            <View key={d.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1.5) }}>
              <Icon name={d.verified ? 'check' : 'doc'} size={18} color={d.verified ? colors.success : colors.warning} />
              <T style={{ flex: 1 }}>{d.name}</T>
              <T variant="caption" color={colors.muted}>{t('usta.validUntil', { date: d.expires })}</T>
            </View>
          ))}
        </Card>
      </Section>
      <Section title={t('usta.about')}><T color={colors.muted}>{p.bio}</T></Section>
      <Section title={t('usta.reviews')}>
        {(['r1', 'r2', 'r3'] as const).map((r) => (
          <Card key={r}>
            <Rating value={5 - (r === 'r3' ? 1 : 0)} />
            <T color={colors.muted}>{t(`usta.${r}`)}</T>
          </Card>
        ))}
      </Section>
    </>
  );
}
