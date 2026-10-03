import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, Header, NotFound, ProviderProfile, Screen, Section, T } from '@/components';
import { actions, formatPrice, useProvider } from '@/services';
import { currentLang } from '@/i18n';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

export default function KaptanDetay() {
  const { t } = useTranslation();
  const { id, start, days: daysParam } = useLocalSearchParams<{ id: string; start?: string; days?: string }>();
  const p = useProvider(id);
  const [tomorrow] = useState(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  if (!p || p.kind !== 'kaptan') return <NotFound />;
  const days = Math.max(1, Number(daysParam) || 1);
  const startDate = start ?? tomorrow;
  const weekly = days >= 7;
  // Sunucudaki hesapla aynı: haftalık ücret yoksa 6 günlük ücret.
  const total = weekly ? (p.weekRateEUR ?? (p.dayRateEUR ?? 0) * 6) * Math.ceil(days / 7) : (p.dayRateEUR ?? 0) * days;
  const lang = currentLang();

  const reserve = async () => {
    if (!requireLevel(2)) return;
    const bid = await attempt(() => actions.bookCaptain({ captainId: p.id, start: startDate, days }));
    if (!bid) return;
    router.push({ pathname: '/odeme', params: { tur: 'kaptan', id: bid } });
  };

  return (
    <Screen footer={<Button icon="calendar" title={t('captain.reserve')} onPress={reserve} />}>
      <Header title={t('captain.title')} />
      <ProviderProfile p={p} />
      <Section title={t('captain.languages')}>
        <View style={{ flexDirection: 'row', gap: space(2) }}>{(p.languages ?? []).map((l) => <Chip key={l} label={l} />)}</View>
      </Section>
      <Section title={t('captain.areas')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{(p.areas ?? []).map((a) => <Chip key={a} label={a} />)}</View>
      </Section>
      <Section title={t('captain.booking')}>
        <Card style={{ borderColor: colors.primary, borderWidth: 1.5 }}>
          <T variant="bodySemi">{t('captain.selected', { start: startDate, count: days })}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T color={colors.muted}>{weekly ? `€${p.weekRateEUR}${t('common.perWeek')}` : `€${p.dayRateEUR}${t('common.perDay')}`}</T>
            <T variant="h3" color={colors.primary}>{t('captain.total')}: {formatPrice(total, 'EUR', lang)}</T>
          </View>
          {weekly ? <T variant="caption" color={colors.success}>{t('captain.weekRate')}</T> : null}
          <T variant="caption" color={colors.muted}>{t('captain.note')}</T>
        </Card>
      </Section>
    </Screen>
  );
}

