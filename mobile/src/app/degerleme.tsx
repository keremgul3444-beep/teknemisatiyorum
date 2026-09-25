import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, EmptyState, Field, Header, ListingCard, Screen, Section, T } from '@/components';
import { formatPrice, useListings, type BoatType } from '@/services';
import { currentLang } from '@/i18n';
import { estimateValue, type Valuation } from '@/features/valuation';

const TYPES: BoatType[] = ['motoryat', 'yelkenli', 'katamaran', 'gulet', 'surat', 'balikci'];

export default function Degerleme() {
  const { t } = useTranslation();
  const listings = useListings();
  const [type, setType] = useState<BoatType>('yelkenli');
  const [year, setYear] = useState('2017');
  const [len, setLen] = useState('12');
  const [res, setRes] = useState<Valuation | null>(null);
  const valid = Number(year) > 1950 && Number(len.replace(',', '.')) > 3;

  return (
    <Screen>
      <Header title={t('valuation.title')} subtitle={t('valuation.subtitle')} />
      <Section title={t('valuation.type')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {TYPES.map((ty) => <Chip key={ty} label={t(`boatType.${ty}`)} selected={type === ty} onPress={() => { setType(ty); setRes(null); }} />)}
        </View>
      </Section>
      <View style={{ flexDirection: 'row', gap: space(3) }}>
        <View style={{ flex: 1 }}><Field label={t('valuation.year')} value={year} onChangeText={(v) => { setYear(v.replace(/\D/g, '')); setRes(null); }} keyboardType="numeric" maxLength={4} /></View>
        <View style={{ flex: 1 }}><Field label={t('valuation.length')} value={len} onChangeText={(v) => { setLen(v); setRes(null); }} keyboardType="decimal-pad" /></View>
      </View>
      <Button title={t('valuation.calc')} disabled={!valid} onPress={() => setRes(estimateValue({ type, year: Number(year), lengthM: Number(len.replace(',', '.')) }, listings))} />

      {res && res.comparables.length === 0 ? <EmptyState icon="chart" title={t('valuation.none')} body={t('valuation.noneBody')} /> : null}
      {res && res.comparables.length > 0 ? (
        <>
          <Card style={{ borderColor: colors.primary, borderWidth: 1.5 }}>
            <T variant="label" color={colors.muted}>{t('valuation.result').toLocaleUpperCase('tr-TR')}</T>
            <T variant="h1" color={colors.primary}>{formatPrice(res.lowEUR, 'EUR', currentLang())} – {formatPrice(res.highEUR, 'EUR', currentLang())}</T>
            <T variant="caption" color={colors.muted}>{t('valuation.basis', { count: res.comparables.length })}</T>
            <View style={{ flexDirection: 'row', gap: space(2), marginTop: space(2) }}>
              <View style={{ flex: 1 }}><Button small title={t('valuation.listFree')} onPress={() => router.push('/ilan-ver')} /></View>
              <View style={{ flex: 1 }}><Button small variant="ghost" title={t('valuation.sellForMe')} onPress={() => router.push('/broker')} /></View>
            </View>
          </Card>
          <Section title={t('valuation.comparables')}>
            {res.comparables.map((l) => <ListingCard key={l.id} listing={l} compact />)}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
