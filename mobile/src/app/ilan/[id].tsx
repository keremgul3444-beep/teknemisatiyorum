import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar, Badge, BoatImage, Button, Card, Chip, Icon, NotFound, PromoBadges, Section, T, goBack, showDemoToast } from '@/components';
import { actions, formatPrice, useFavorites, useListing, useSeller } from '@/services';
import { currentLang, tx } from '@/i18n';
import { WEB_URL } from '@/services/mode';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

/** İlan detayı ("Liman"): fotoğraf üstte, başlık ve fiyat, büyük rakamlı üç özellik, sonra ayrıntılar. */
export default function IlanDetay() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = useListing(id);
  const seller = useSeller(l?.sellerId);
  // Gerçek modda ilanın güncel hali (fotoğraflar, karne özeti) sayfa açılınca çekilir.
  useEffect(() => { if (id) attempt(() => actions.loadListing(id)); }, [id]);
  const fav = useFavorites().includes(id ?? '');
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  if (!l) return <NotFound />;
  const lang = currentLang();
  const galleryW = Math.min(width, 600);
  const photoCount = l.photoUrls?.length || 4;

  const message = async () => {
    if (!requireLevel(1)) return;
    const conv = await attempt(() => actions.startConversation({ kind: 'ilan', id: l.id, title: `${l.brand} ${l.model} · ${l.year}` }, seller?.name ?? t('listing.seller')));
    if (conv) router.push(`/sohbet/${conv}`);
  };
  // Gerçek paylaşım: sitedeki ilan adresi (kısa adres asıl adrese yönlenir).
  const share = () => {
    const url = l.webUrl ?? `${WEB_URL}/ilan/${l.id}`;
    const message = `${l.brand} ${l.model} · ${l.year} · ${formatPrice(l.price, l.currency, lang)}\n${url}`;
    Share.share({ message, url, title: `${l.brand} ${l.model}` }).catch(() => undefined);
  };
  const toggleFav = async () => {
    if (!requireLevel(1)) return;
    await attempt(() => actions.toggleFavorite(l.id));
    showDemoToast(fav ? t('listing.favRemoved') : t('listing.favAdded'));
  };
  // Üç büyük rakam: alıcının ilk baktığı ölçüler.
  const facts: [string, string][] = [
    [t('listing.length'), `${l.lengthM.toLocaleString(lang)} m`], [t('listing.year'), String(l.year)], [t('listing.cabins'), String(l.cabins)],
  ];
  const specs: [string, string][] = [
    [t('listing.type'), t(`boatType.${l.type}`)],
    // Boş bırakılan isteğe bağlı alanlar satır olarak gösterilmez (eski demo ilanları "—" taşır).
    ...(l.engine && l.engine !== '—' ? [[t('listing.engine'), l.engine] as [string, string]] : []),
    ...(l.engineHours != null ? [[t('listing.engineHours'), t('listing.engineHoursValue', { hours: l.engineHours.toLocaleString(lang) })] as [string, string]] : []),
    ...(l.flag ? [[t('listing.flag'), t(l.flag === 'tr' ? 'listing.flagTr' : 'listing.flagForeign')] as [string, string]] : []),
    [t('listing.location'), l.location],
  ];
  // Fiyatın altında: satıcının pazarlık ve takas tercihi.
  const terms = [l.negotiable ? t('listing.negotiable') : null, l.tradeIn ? t('listing.tradeIn') : null].filter(Boolean).join(' · ');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(8) }}>
        <View>
          <FlatList horizontal pagingEnabled data={l.photoUrls?.length ? l.photoUrls.map((_, i) => i) : [0, 1, 2, 3]} keyExtractor={(i) => String(i)} showsHorizontalScrollIndicator={false}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / galleryW))} scrollEventThrottle={32}
            style={{ width: galleryW }} renderItem={({ item }) => <View style={{ width: galleryW }}><BoatImage seed={l.photoSeed} frame={item} height={300} uri={l.photoUrls?.[item]} /></View>} />
          <View style={{ position: 'absolute', top: space(3), left: space(4), right: space(4), flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundBtn icon="back" label={t('common.back')} onPress={goBack} />
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <RoundBtn icon="share" label={t('listing.share')} onPress={share} />
              <RoundBtn icon="heart" label={t('profile.favorites')} filled={fav} onPress={toggleFav} />
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: space(3), left: space(4), right: space(4), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <PromoBadges promo={l.promo} priceDrop={l.priceDrop} />
            <View style={{ backgroundColor: colors.overlay, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
              <T variant="caption" color={colors.white} style={{ fontFamily: fonts.bodySemi }}>{page + 1}/{photoCount}</T>
            </View>
          </View>
        </View>

        <View style={{ padding: space(5), gap: space(5) }}>
          {l.status === 'onay-bekliyor' ? (
            <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.button, padding: space(3) }}>
              <T variant="caption" color={colors.accentText} style={{ fontFamily: fonts.bodySemi }}>{t('listing.pending')}</T>
            </View>
          ) : null}
          <View style={{ gap: space(2.5) }}>
            {l.badges.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) }}>{l.badges.map((b) => <Badge key={b} kind={b} />)}</View> : null}
            <View style={{ gap: space(1) }}>
              <T variant="h1">{l.brand} {l.model}</T>
              <T variant="caption" color={colors.muted} style={{ fontSize: 14, lineHeight: 20 }}>{l.year} · {l.location} · {t(`boatType.${l.type}`)}</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space(2.5), flexWrap: 'wrap' }}>
              <T variant="h1" color={colors.primary} style={{ fontSize: 30, lineHeight: 36 }}>{formatPrice(l.price, l.currency, lang)}</T>
              {l.priceDrop ? (
                <T variant="caption" color={colors.muted} style={{ fontSize: 15, textDecorationLine: 'line-through' }} accessibilityLabel={t('listing.previousPrice', { price: formatPrice(l.priceDrop.previousPrice, l.currency, lang) })}>
                  {formatPrice(l.priceDrop.previousPrice, l.currency, lang)}
                </T>
              ) : null}
            </View>
            {terms ? <T variant="caption" color={colors.muted} style={{ fontFamily: fonts.bodySemi }}>{terms}</T> : null}
          </View>

          <View style={{ flexDirection: 'row', gap: space(2.5) }}>
            {facts.map(([k, v]) => (
              <View key={k} style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingVertical: space(3.5), paddingHorizontal: space(3), gap: space(0.5) }}>
                <T variant="h2" numberOfLines={1} style={{ fontSize: 22, lineHeight: 28 }}>{v}</T>
                <T variant="caption" color={colors.muted}>{k}</T>
              </View>
            ))}
          </View>

          <Section title={t('listing.specs')}>
            <Card padded={false}>
              {specs.map(([k, v], i) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(3), paddingVertical: space(3), paddingHorizontal: space(4),
                  borderTopWidth: i ? 1 : 0, borderColor: colors.line }}>
                  <T variant="caption" color={colors.muted} style={{ fontSize: 14, lineHeight: 20 }}>{k}</T>
                  <T variant="bodySemi" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{v}</T>
                </View>
              ))}
            </Card>
          </Section>

          {l.equipment.length ? (
            <Section title={t('listing.equipment')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>{l.equipment.map((e) => <Chip key={e} label={t(`equipment.${e}`)} />)}</View>
            </Section>
          ) : null}

          {l.description && l.description !== '—' ? <Section title={t('listing.description')}><T color={colors.muted}>{l.description}</T></Section> : null}

          <Section title={t('listing.logbook')}>
            <Card onPress={l.isMine && l.boatId ? () => router.push(`/teknelerim/${l.boatId}`) : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="logbook" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: space(0.5) }}>
                  {l.logbookCount ? (
                    <>
                      <T variant="h3">{t('listing.logbookCount', { count: l.logbookCount })}</T>
                      {l.logbookLatest?.length ? l.logbookLatest.map((e) => (
                        <T key={e.id} variant="caption" color={colors.muted}>{tx(t, e.title)} · {e.date.slice(0, 4)}</T>
                      )) : (
                        <>
                          <T variant="caption" color={colors.muted}>{t('listing.logbookSample1')}</T>
                          <T variant="caption" color={colors.muted}>{t('listing.logbookSample2')}</T>
                        </>
                      )}
                    </>
                  ) : <T color={colors.muted}>{t('listing.logbookEmpty')}</T>}
                </View>
                {l.isMine && l.boatId ? <Icon name="chevron" size={18} color={colors.muted} /> : null}
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
        <View style={{ flex: 1 }}>{l.isMine || l.sellerId === 'me'
          ? <Button variant="secondary" icon="anchor" title={t('profile.listings')} onPress={() => router.push('/profil/ilanlarim')} />
          : <Button icon="mail" title={t('listing.message')} onPress={message} />}</View>
      </View>
    </SafeAreaView>
  );
}

/** Fotoğraf üstündeki yuvarlak düğme: 44 px dokunma alanı. */
function RoundBtn({ icon, onPress, filled, label }: { icon: string; onPress: () => void; filled?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
      <Icon name={icon} size={20} color={filled ? colors.accent : colors.text} filled={filled} />
    </Pressable>
  );
}
