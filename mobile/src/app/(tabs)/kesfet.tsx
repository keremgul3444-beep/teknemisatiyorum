import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { AssistantInput, Card, Chip, Icon, ListingCard, Screen, Section, T } from '@/components';
import { actions, useListings } from '@/services';
import { useRemote } from '@/services/useRemote';
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
  // Ücretli vitrin şeridi (gerçek modda sunucudan; demo modunda boş).
  const show = useRemote(() => actions.showcase()).data;
  const featured = show?.featured ?? [];
  const urgent = show?.urgent ?? [];
  // Zilde okunmamış bildirim sayısı (gerçek modda).
  const unread = useRemote(() => actions.unreadCount()).data ?? 0;
  const ask = (text: string) => text.trim() && router.push({ pathname: '/asistan', params: { q: text.trim() } });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2) }}>
        <View style={{ flex: 1, gap: space(0.5) }}>
          <T variant="caption" color={colors.muted} style={{ fontSize: 13, fontFamily: fonts.bodySemi }}>{loggedIn ? t('home.helloName', { name }) : t('home.hello')}</T>
          <T variant="h1">{t('home.title')}</T>
        </View>
        <Pressable onPress={() => router.push('/profil/bildirimler')} accessibilityRole="button" accessibilityLabel={t('profile.notifications')} hitSlop={4}
          style={{ width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={20} color={colors.text} />
          {unread ? (
            <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: radius.pill, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="caption" style={{ fontSize: 11, lineHeight: 14, color: colors.white, fontFamily: fonts.bodyBold }}>{unread > 99 ? '99+' : String(unread)}</T>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={{ gap: space(1.5) }}>
        <AssistantInput value={q} onChangeText={setQ} onSubmit={() => { const v = q.trim() || t('assistant.ex1'); setQ(v); ask(v); }} placeholder={t('assistant.placeholder')}
          label={t('assistant.label')} buttonLabel={t('assistant.search')} />
        <T variant="caption" color={colors.muted} style={{ paddingHorizontal: space(1) }}>{t('assistant.hint')}</T>
      </View>
      {/* Örnek aramalar tek satırda yana kayar; ekranın üstünü kaplamaz. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space(5) }}
        contentContainerStyle={{ gap: space(2), paddingHorizontal: space(5) }}>
        {(['ex1', 'ex2', 'ex3'] as const).map((k) => <Chip key={k} label={t(`assistant.${k}`)} onPress={() => ask(t(`assistant.${k}`))} />)}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: space(2) }}>
        {CATS.map((c) => (
          <Pressable key={c.k} onPress={() => router.push(c.to)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg - 6, paddingVertical: space(3), alignItems: 'center', gap: space(1.5), opacity: pressed ? 0.8 : 1 })}>
            <Icon name={c.icon} size={22} color={colors.primary} />
            <T variant="caption" style={{ fontFamily: fonts.bodySemi }}>{t(`home.${c.k}`)}</T>
          </Pressable>
        ))}
      </View>

      {featured.length ? (
        <Section title={t('promo.showcase')}>
          <FlatList horizontal data={featured} keyExtractor={(l) => l.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space(3) }} renderItem={({ item }) => <ListingCard listing={item} width={280} />} />
        </Section>
      ) : null}

      {urgent.length ? (
        <Section title={t('home.urgentTitle')}>
          <FlatList horizontal data={urgent} keyExtractor={(l) => l.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space(3) }} renderItem={({ item }) => <ListingCard listing={item} width={280} />} />
        </Section>
      ) : null}

      <Section title={t('home.forYou')} actionLabel={t('common.seeAll')} onAction={() => router.push('/ilanlar')}>
        <FlatList horizontal data={forYou} keyExtractor={(l) => l.id} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space(3) }} renderItem={({ item }) => <ListingCard listing={item} width={280} />} />
      </Section>

      <PromoCard icon="chart" title={t('home.priceDropsTitle')} body={t('home.priceDropsBody')} onPress={() => router.push({ pathname: '/ilanlar', params: { dusen: '1' } })} />
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
        <View style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
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
