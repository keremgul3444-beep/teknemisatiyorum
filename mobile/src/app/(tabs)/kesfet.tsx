import { useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Card, Chip, Icon, ListingCard, Screen, Section, T } from '@/components';
import { useListings } from '@/services';
import { useSession } from '@/session/role';

const CATS = [
  { k: 'catSale', icon: 'anchor', to: '/ilanlar' },
  { k: 'catUsta', icon: 'wrench', to: '/usta' },
  { k: 'catExpertise', icon: 'clipboard', to: '/ekspertiz' },
  { k: 'catCaptain', icon: 'compass', to: '/kaptan' },
] as const;

export default function Kesfet() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const loggedIn = useSession((s) => s.loggedIn);
  const name = useSession((s) => s.name.split(' ')[0]);
  const listings = useListings().filter((l) => l.status === 'yayinda');
  const forYou = [...listings].sort((a, b) => b.badges.length - a.badges.length || b.year - a.year).slice(0, 6);
  const ask = (text: string) => text.trim() && router.push({ pathname: '/asistan', params: { q: text.trim() } });

  return (
    <Screen>
      <View style={{ gap: space(1), marginTop: space(2) }}>
        <T variant="caption" color={colors.muted}>{loggedIn ? t('home.helloName', { name }) : t('home.hello')} 👋</T>
        <T variant="h1">{t('home.title')}</T>
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, padding: space(3.5), gap: space(2) }}>
        <T variant="label" color={colors.primary}>✦ {t('assistant.label')}</T>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => ask(q)} placeholder={t('assistant.placeholder')} placeholderTextColor={colors.muted}
          multiline returnKeyType="search" blurOnSubmit
          style={{ fontFamily: fonts.body, fontSize: 15, color: colors.text, minHeight: 44, textAlignVertical: 'top' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T variant="caption" color={colors.muted}>{t('assistant.hint')}</T>
          <Pressable onPress={() => ask(q || t('assistant.ex1'))} style={{ backgroundColor: colors.primary, borderRadius: radius.button - 2, paddingVertical: space(2), paddingHorizontal: space(4) }}>
            <T variant="bodySemi" color={colors.white}>{t('assistant.search')}</T>
          </Pressable>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {(['ex1', 'ex2', 'ex3'] as const).map((k) => <Chip key={k} label={t(`assistant.${k}`)} onPress={() => ask(t(`assistant.${k}`))} />)}
      </View>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {CATS.map((c) => (
          <Pressable key={c.k} onPress={() => router.push(c.to)}
            style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.chip, paddingVertical: space(3), alignItems: 'center', gap: space(1.5) }}>
            <Icon name={c.icon} size={22} color={colors.primary} />
            <T variant="caption" style={{ fontFamily: fonts.bodySemi }}>{t(`home.${c.k}`)}</T>
          </Pressable>
        ))}
      </View>

      <Section title={t('home.forYou')} actionLabel={t('common.seeAll')} onAction={() => router.push('/ilanlar')}>
        <FlatList horizontal data={forYou} keyExtractor={(l) => l.id} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space(3) }} renderItem={({ item }) => <ListingCard listing={item} width={280} />} />
      </Section>

      <PromoCard icon="chart" title={t('home.valuationTitle')} body={t('home.valuationBody')} onPress={() => router.push('/degerleme')} />
      <PromoCard icon="bell" title={t('home.requestTitle')} body={t('home.requestBody')} onPress={() => router.push('/aramalar')} />
      <PromoCard icon="briefcase" title={t('home.sellTitle')} body={t('home.sellBody')} onPress={() => router.push('/broker')} />
    </Screen>
  );
}

function PromoCard({ icon, title, body, onPress }: { icon: string; title: string; body: string; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="caption" color={colors.muted}>{body}</T>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </View>
    </Card>
  );
}
