import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import type { Provider } from '@/services';
import { Card } from './Card';
import { T } from './T';
import { Rating } from './Rating';
import { Badge } from './Badge';
import { Avatar } from './Avatar';

export function ProviderCard({ provider: p, onPress }: { provider: Provider; onPress?: () => void }) {
  const { t } = useTranslation();
  const go = onPress ?? (() => router.push(p.kind === 'kaptan' ? `/kaptan/${p.id}` : `/usta/${p.id}`));
  const sub = p.kind === 'usta' ? p.categories.map((c) => t(`usta.cat.${c}`)).join(', ') : p.kind === 'kaptan' ? (p.areas ?? []).join(' · ') : t('expertise.surveyor');
  return (
    <Card onPress={go}>
      <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
        <Avatar name={p.name.replace(/^(Kaptan|Eksper) /, '')} />
        <View style={{ flex: 1, gap: space(0.5) }}>
          <T variant="h3" numberOfLines={1}>{p.name}</T>
          <T variant="caption" color={colors.muted} numberOfLines={1}>{sub}</T>
          <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
            <Rating value={p.rating} count={p.reviewCount} />
            <T variant="caption" color={colors.muted}>{p.region}</T>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: space(1.5) }}>
          {p.verified ? <Badge kind="dogrulanmis" /> : <Badge kind="beklemede" />}
          <T variant="caption" color={colors.primary} style={{ fontFamily: 'Inter_700Bold' }}>
            {p.kind === 'kaptan' ? `€${p.dayRateEUR}${t('common.perDay')}` : p.kind === 'usta' ? t('usta.freeSurvey') : ''}
          </T>
        </View>
      </View>
    </Card>
  );
}
