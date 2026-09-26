import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Card, Chip, Header, Icon, ListingCard, Screen, Section, SuccessView, T } from '@/components';
import { actions, formatPrice, useExpertisePackages, useListing } from '@/services';
import { currentLang } from '@/i18n';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';
import { localDateString } from '@/features/dates';
import { defaultPackageId, isPopularPackage } from '@/features/expertise';

const SLOTS = ['morning', 'noon', 'afternoon'] as const;

export default function Ekspertiz() {
  const { t } = useTranslation();
  const { ilan } = useLocalSearchParams<{ ilan?: string }>();
  const listing = useListing(ilan);
  const packages = useExpertisePackages();
  // Paketler sunucudan sonradan gelebilir; seçim yapılmadıysa önerilen paket kullanılır.
  const [picked, setPkg] = useState<string>();
  const pkg = picked ?? defaultPackageId(packages) ?? '';
  const [dateIdx, setDateIdx] = useState<number | null>(null);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>('morning');
  const [done, setDone] = useState(false);
  const lang = currentLang();
  const dates = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const fmt = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  if (done && dateIdx !== null) {
    return (
      <Screen>
        <Header title="" />
        <SuccessView title={t('expertise.doneTitle')} body={t('expertise.doneBody', { date: fmt.format(dates[dateIdx]), slot: t(`expertise.${slot}`) })} actions={[
          { title: t('expertise.sampleReport'), onPress: () => router.push('/ekspertiz/rapor') },
          { title: t('common.done'), onPress: () => router.dismissTo('/hizmetler'), variant: 'ghost' },
        ]} />
      </Screen>
    );
  }

  const book = async () => {
    if (!requireLevel(1) || dateIdx === null) return;
    const id = await attempt(() => actions.bookExpertise({ packageId: pkg, listingId: listing?.id, date: localDateString(dates[dateIdx]), slot }));
    if (id) setDone(true);
  };

  return (
    <Screen footer={<Button title={t('expertise.book')} disabled={dateIdx === null || !pkg} onPress={book} />}>
      <Header title={t('expertise.title')} subtitle={t('expertise.subtitle')}
        right={<Button small variant="ghost" title={t('expertise.sampleReport')} onPress={() => router.push('/ekspertiz/rapor')} />} />
      {listing ? <Section title={t('expertise.forListing')}><ListingCard listing={listing} compact /></Section> : null}
      <Section title={t('expertise.packages')}>
        {packages.map((p) => (
          <Card key={p.id} onPress={() => setPkg(p.id)} style={pkg === p.id ? { borderColor: colors.primary, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="h3">{p.name}</T>
              <T variant="h3" color={colors.primary}>{formatPrice(p.priceTRY, 'TRY', lang)}</T>
            </View>
            {isPopularPackage(packages, p.id) ? <Chip label={t('expertise.popular')} selected /> : null}
            {p.items.map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
                <Icon name="check" size={14} color={colors.success} /><T variant="caption">{i}</T>
              </View>
            ))}
          </Card>
        ))}
      </Section>
      <Section title={t('expertise.date')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
          {dates.map((d, i) => <Chip key={i} label={fmt.format(d)} selected={dateIdx === i} onPress={() => setDateIdx(i)} />)}
        </ScrollView>
      </Section>
      <Section title={t('expertise.slot')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {SLOTS.map((s) => <Chip key={s} label={t(`expertise.${s}`)} selected={slot === s} onPress={() => setSlot(s)} />)}
        </View>
      </Section>
    </Screen>
  );
}
