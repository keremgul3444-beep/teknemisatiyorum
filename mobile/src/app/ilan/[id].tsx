import { useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar, Badge, BoatImage, Button, Card, Chip, Icon, NotFound, Section, T, goBack, showDemoToast } from '@/components';
import { actions, formatPrice, useFavorites, useListing, useSeller } from '@/services';
import { currentLang } from '@/i18n';
import { requireLevel } from '@/session/role';

export default function IlanDetay() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = useListing(id);
  const seller = useSeller(l?.sellerId);
  const fav = useFavorites().includes(id ?? '');
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  if (!l) return <NotFound />;
  const lang = currentLang();
  const galleryW = Math.min(width, 600);

  const message = () => {
    if (!requireLevel(1)) return;
    const conv = actions.startConversation({ kind: 'ilan', id: l.id, title: `${l.brand} ${l.model} · ${l.year}` }, seller?.name ?? t('listing.seller'));
    router.push(`/sohbet/${conv}`);
  };
  const toggleFav = () => {
    actions.toggleFavorite(l.id);
    showDemoToast(fav ? t('listing.favRemoved') : t('listing.favAdded'));
  };
  const specs: [string, string][] = [
    [t('listing.length'), `${l.lengthM.toLocaleString(lang)} m`], [t('listing.year'), String(l.year)],
    [t('listing.type'), t(`boatType.${l.type}`)], [t('listing.cabins'), String(l.cabins)],
    [t('listing.engine'), l.engine], [t('listing.location'), l.location],
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(8) }}>
        <View>
          <FlatList horizontal pagingEnabled data={[0, 1, 2, 3]} keyExtractor={(i) => String(i)} showsHorizontalScrollIndicator={false}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / galleryW))} scrollEventThrottle={32}
            style={{ width: galleryW }} renderItem={({ item }) => <View style={{ width: galleryW }}><BoatImage seed={l.photoSeed + item} height={280} /></View>} />
          <View style={{ position: 'absolute', top: space(3), left: space(4), right: space(4), flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundBtn icon="back" label={t('common.back')} onPress={goBack} />
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <RoundBtn icon="share" label={t('listing.share')} onPress={() => showDemoToast(t('demo.linkCopied'))} />
              <RoundBtn icon="heart" label={t('profile.favorites')} filled={fav} onPress={toggleFav} />
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: space(3), right: space(4), backgroundColor: colors.overlay, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(0.5) }}>
            <T variant="caption" color={colors.white}>{page + 1}/4</T>
          </View>
        </View>

        <View style={{ padding: space(5), gap: space(5) }}>
          {l.status === 'onay-bekliyor' ? <Card><T color={colors.warning}>{t('listing.pending')}</T></Card> : null}
          <View style={{ gap: space(2) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>{l.badges.map((b) => <Badge key={b} kind={b} />)}</View>
            <T variant="h1">{l.brand} {l.model}</T>
            <T variant="h1" color={colors.primary} style={{ fontSize: 26 }}>{formatPrice(l.price, l.currency, lang)}</T>
          </View>

          <Section title={t('listing.specs')}>
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {specs.map(([k, v]) => (
                  <View key={k} style={{ width: '50%', paddingVertical: space(2) }}>
                    <T variant="caption" color={colors.muted}>{k}</T>
                    <T variant="bodySemi">{v}</T>
                  </View>
                ))}
              </View>
            </Card>
          </Section>

          {l.equipment.length ? (
            <Section title={t('listing.equipment')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{l.equipment.map((e) => <Chip key={e} label={t(`equipment.${e}`)} />)}</View>
            </Section>
          ) : null}

          <Section title={t('listing.description')}><T color={colors.muted}>{l.description}</T></Section>

          <Section title={t('listing.logbook')}>
            <Card onPress={l.logbookCount ? () => router.push('/teknelerim/b1') : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <Icon name="logbook" size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  {l.logbookCount ? (
                    <>
                      <T variant="h3">{t('listing.logbookCount', { count: l.logbookCount })}</T>
                      <T variant="caption" color={colors.muted}>{t('listing.logbookSample1')}</T>
                      <T variant="caption" color={colors.muted}>{t('listing.logbookSample2')}</T>
                    </>
                  ) : <T color={colors.muted}>{t('listing.logbookEmpty')}</T>}
                </View>
                {l.logbookCount ? <T variant="caption" color={colors.primary} style={{ fontFamily: fonts.bodySemi }}>{t('listing.logbookSee')} →</T> : null}
              </View>
            </Card>
          </Section>

          <Section title={t('listing.seller')}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <Avatar name={seller?.name ?? '?'} />
                <View style={{ flex: 1, gap: space(0.5) }}>
                  <T variant="h3">{seller?.name ?? '—'}</T>
                  <T variant="caption" color={colors.muted}>{seller?.companyId ? t('listing.company') : t('listing.memberSince', { year: seller?.since ?? 2024 })}</T>
                </View>
                <Badge kind="dogrulanmis" />
              </View>
            </Card>
          </Section>
          <View style={{ flexDirection: 'row', gap: space(2) }}>
            <Icon name="shield" size={16} color={colors.muted} />
            <T variant="caption" color={colors.muted} style={{ flex: 1 }}>{t('listing.safety')}</T>
          </View>
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space(3), padding: space(4), borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
        <View style={{ flex: 1 }}><Button variant="ghost" icon="clipboard" title={t('listing.requestExpertise')} onPress={() => router.push({ pathname: '/ekspertiz', params: { ilan: l.id } })} /></View>
        <View style={{ flex: 1 }}><Button icon="mail" title={t('listing.message')} onPress={message} /></View>
      </View>
    </SafeAreaView>
  );
}

function RoundBtn({ icon, onPress, filled, label }: { icon: string; onPress: () => void; filled?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={filled ? colors.danger : colors.text} filled={filled} />
    </Pressable>
  );
}
