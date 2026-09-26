import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Card, Icon, Screen, Section, T } from '@/components';
import { useJobs } from '@/services';
import { detectCategory } from '@tms/shared';

const CARDS = [
  { k: 'usta', icon: 'wrench', to: '/usta' },
  { k: 'expertise', icon: 'clipboard', to: '/ekspertiz' },
  { k: 'captain', icon: 'compass', to: '/kaptan' },
  { k: 'broker', icon: 'briefcase', to: '/broker' },
] as const;

export default function Hizmetler() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const ongoing = useJobs().filter((j) => j.status !== 'degerlendirildi');
  const ask = () => router.push({ pathname: '/is/yeni', params: { kategori: detectCategory(text) ?? '', baslik: text } });

  return (
    <Screen>
      <View style={{ gap: space(1), marginTop: space(2) }}>
        <T variant="h1">{t('services.title')}</T>
        <T color={colors.muted}>{t('services.subtitle')}</T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        {CARDS.map((c) => (
          <Card key={c.k} onPress={() => router.push(c.to)} style={{ width: '47.5%', minHeight: 150 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.icon} size={22} color={colors.white} />
            </View>
            <T variant="h3">{t(`services.${c.k}`)}</T>
            <T variant="caption" color={colors.muted}>{t(`services.${c.k}Body`)}</T>
          </Card>
        ))}
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, padding: space(3.5), gap: space(2) }}>
        <T variant="label" color={colors.primary}>✦ {t('services.askTitle').toLocaleUpperCase('tr-TR')}</T>
        <TextInput value={text} onChangeText={setText} placeholder={t('services.askPh')} placeholderTextColor={colors.muted} onSubmitEditing={ask}
          style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, paddingVertical: space(1) }} />
        <Pressable onPress={ask} style={{ alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: radius.button - 2, paddingVertical: space(2), paddingHorizontal: space(4) }}>
          <T variant="bodySemi" color={colors.white}>{t('services.askGo')}</T>
        </Pressable>
      </View>

      <Section title={t('services.ongoing')}>
        {ongoing.length === 0 ? <T color={colors.muted}>{t('services.noJobs')}</T> : ongoing.map((j) => (
          <Card key={j.id} onPress={() => router.push(`/is/${j.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Icon name="wrench" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{j.title}</T>
                <T variant="caption" color={colors.muted}>{t(`usta.cat.${j.category}`)} · {t(`job.steps.${j.status === 'degerlendirildi' ? 'tamam' : j.status}`)}</T>
              </View>
              <Icon name="chevron" size={18} color={colors.muted} />
            </View>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
