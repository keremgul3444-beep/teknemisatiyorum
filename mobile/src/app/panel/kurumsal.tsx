import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Avatar, BoatImage, Button, Card, Header, Icon, ListingCard, Screen, Section, T, showDemoToast } from '@/components';
import { useCompanies, useListings } from '@/services';

export default function KurumsalPanel() {
  const { t } = useTranslation();
  const company = useCompanies()[0];
  const all = useListings();
  const listings = all.filter((l) => company.listingIds.includes(l.id));
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Screen>
      <Header title={t('corporate.title')} />
      <Card padded={false}>
        <BoatImage seed={4} height={90} />
        <View style={{ padding: space(4), flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
          <Avatar name={company.name} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{company.name}</T>
            <T variant="caption" color={colors.muted}>{t(`corporate.kind.${company.kind}`)} · {company.city}</T>
          </View>
        </View>
      </Card>

      <Section title={t('corporate.staff')} actionLabel={t('corporate.invite')} onAction={() => showDemoToast(t('corporate.invited'))}>
        <Card>
          {company.staff.map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1) }}>
              <Avatar name={s} size={34} /><T>{s}</T>
            </View>
          ))}
        </Card>
      </Section>

      <Section title={t('corporate.listings')}>
        {listings.map((l) => (
          <View key={l.id} style={{ gap: space(2) }}>
            <Pressable onPress={() => toggle(l.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: sel.includes(l.id) ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {sel.includes(l.id) ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              <T variant="caption" color={colors.muted}>{l.brand} {l.model}</T>
            </Pressable>
            <ListingCard listing={l} compact />
          </View>
        ))}
        <Button icon="sparkle" title={t('corporate.feature', { count: sel.length })} disabled={!sel.length}
          onPress={() => { showDemoToast(t('corporate.featured', { count: sel.length })); setSel([]); }} />
      </Section>
    </Screen>
  );
}
