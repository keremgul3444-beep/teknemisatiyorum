import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { BoatImage, EmptyState, Header, Screen, T } from '@/components';
import { useListings } from '@/services';
import { currentLang } from '@/i18n';
import { COMPARE_MAX, compareRows } from '@/features/compare';

const COL = 150;
const LABEL = 92;

/** İlan karşılaştırma: sütunlar ilanlar, satırlar özellikler; en iyi değer yeşil. Yana kaydırılır. */
export default function Karsilastir() {
  const { t } = useTranslation();
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const wanted = String(ids).split(',').filter(Boolean).slice(0, COMPARE_MAX);
  const all = useListings();
  const listings = wanted.map((id) => all.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l);
  if (listings.length < 2) {
    return (
      <Screen>
        <Header title={t('compare.title')} />
        <EmptyState icon="list" title={t('compare.needTwo')} body={t('compare.hint')} actionLabel={t('profile.favorites')} onAction={() => router.push('/profil/favoriler')} />
      </Screen>
    );
  }
  const rows = compareRows(listings, t, currentLang());
  return (
    <Screen padded={false}>
      <View style={{ padding: space(5), paddingBottom: space(3) }}>
        <Header title={t('compare.title')} subtitle={t('compare.count', { n: listings.length })} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(5), paddingBottom: space(6) }}>
        <View>
          {/* Başlık satırı: fotoğraf + ad; dokununca ilana gider. */}
          <View style={{ flexDirection: 'row', gap: space(2), marginBottom: space(2) }}>
            <View style={{ width: LABEL }} />
            {listings.map((l) => (
              <Pressable key={l.id} onPress={() => router.push(`/ilan/${l.id}`)} accessibilityRole="link" style={{ width: COL, gap: space(1.5) }}>
                <BoatImage seed={l.photoSeed} height={90} rounded={radius.sm} uri={l.photoUrls?.[0]} />
                <T variant="caption" numberOfLines={2} style={{ fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 17 }}>{l.brand} {l.model}</T>
              </Pressable>
            ))}
          </View>
          {rows.map((r, i) => (
            <View key={r.key} style={{ flexDirection: 'row', gap: space(2), paddingVertical: space(2.5), borderTopWidth: 1, borderColor: colors.line, backgroundColor: i % 2 ? colors.surface : 'transparent', borderRadius: radius.xs }}>
              <T variant="caption" color={colors.muted} style={{ width: LABEL, paddingLeft: space(1) }}>{r.label}</T>
              {r.values.map((v, k) => (
                <T key={k} variant="caption" numberOfLines={3} color={r.best === k ? colors.success : colors.text}
                  style={{ width: COL, fontFamily: r.best === k ? fonts.bodyBold : fonts.body, fontSize: 13, lineHeight: 18 }}
                  accessibilityLabel={r.best === k ? `${v} · ${t('compare.best')}` : undefined}>
                  {v}
                </T>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {/* Açıklama yana kayan tablonun dışında: ekran genişliğinde sarar. */}
      <T variant="caption" color={colors.muted} style={{ paddingHorizontal: space(5), paddingBottom: space(6) }}>{t('compare.legend')}</T>
    </Screen>
  );
}
