import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Chip, DateRangePicker, Header, ProviderCard, Screen, Section, T, type DateRange } from '@/components';
import { useProviders } from '@/services';
import { currentLang } from '@/i18n';

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12); return d.toISOString().slice(0, 10); };

export default function KaptanList() {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange | null>({ start: tomorrow(), days: 1 });
  const [region, setRegion] = useState<string | undefined>();
  const captains = useProviders('kaptan');
  const regions = [...new Set(captains.map((c) => c.region))];
  const list = captains.filter((c) => !region || c.region === region).sort((a, b) => b.rating - a.rating);

  return (
    <Screen>
      <Header title={t('captain.title')} subtitle={t('captain.subtitle')} />
      <Section title={t('captain.dates')}>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <Chip label={t('captain.daily')} selected={range?.days === 1} onPress={() => setRange({ start: tomorrow(), days: 1 })} />
          <Chip label={t('captain.weekly')} selected={range?.days === 7} onPress={() => setRange({ start: tomorrow(), days: 7 })} />
        </View>
        <T variant="caption" color={colors.muted}>{t('captain.pickHint')}</T>
        <DateRangePicker value={range} onChange={setRange} lang={currentLang()} />
        {range ? <T variant="bodySemi" color={colors.primary}>{t('captain.selected', { start: range.start, count: range.days })}</T> : null}
      </Section>
      <Section title={t('captain.region')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          <Chip label={t('common.all')} selected={!region} onPress={() => setRegion(undefined)} />
          {regions.map((r) => <Chip key={r} label={r} selected={region === r} onPress={() => setRegion(r)} />)}
        </ScrollView>
      </Section>
      <Section title={t('captain.list', { count: list.length })}>
        {list.map((c) => (
          <ProviderCard key={c.id} provider={c}
            onPress={() => router.push({ pathname: '/kaptan/[id]', params: { id: c.id, start: range?.start ?? tomorrow(), days: String(range?.days ?? 1) } })} />
        ))}
      </Section>
    </Screen>
  );
}
