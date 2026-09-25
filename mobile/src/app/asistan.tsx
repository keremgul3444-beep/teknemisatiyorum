import { useMemo, useState } from 'react';
import { TextInput, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Chip, EmptyState, Header, Icon, ListingCard, QueryChips, Screen, Section, T, showDemoToast } from '@/components';
import { actions, useListings } from '@/services';
import { parseQuery, isEmptyQuery } from '@/features/assistant/parse';
import { matchListings } from '@/features/assistant/match';
import { criterionLabel } from '@/features/assistant/chips';
import { requireLevel } from '@/session/role';

export default function Asistan() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const listings = useListings();
  const parsed = useMemo(() => parseQuery(q), [q]);
  const empty = isEmptyQuery(parsed);
  const result = useMemo(() => matchListings(listings, parsed), [listings, parsed]);

  const save = () => {
    if (!requireLevel(1)) return;
    actions.saveSearch(q);
    showDemoToast(t('assistant.saved'));
  };

  return (
    <Screen footer={!empty ? <Button icon="bell" title={t('assistant.save')} onPress={save} /> : undefined}>
      <Header title={t('assistant.title')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.card, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.primary, paddingLeft: space(3) }}>
        <T color={colors.primary}>✦</T>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => setQ(draft)} returnKeyType="search" placeholder={t('assistant.placeholder')}
          placeholderTextColor={colors.muted} style={{ flex: 1, paddingVertical: space(3), fontFamily: fonts.body, fontSize: 15, color: colors.text }} />
        <Pressable onPress={() => setQ(draft)} style={{ padding: space(3) }}><Icon name="search" size={20} color={colors.primary} /></Pressable>
      </View>

      {empty ? (
        <>
          <EmptyState icon="sparkle" title={t('assistant.notUnderstood')} body={t('assistant.notUnderstoodBody')} />
          <View style={{ gap: space(2) }}>
            {(['ex1', 'ex2', 'ex3'] as const).map((k) => <Chip key={k} label={t(`assistant.${k}`)} onPress={() => { setDraft(t(`assistant.${k}`)); setQ(t(`assistant.${k}`)); }} />)}
          </View>
          <Button variant="ghost" title={t('assistant.browseAll')} onPress={() => router.push('/ilanlar')} />
        </>
      ) : (
        <>
          <View style={{ gap: space(2) }}>
            <T variant="label" color={colors.muted}>{t('assistant.understood').toLocaleUpperCase('tr-TR')}</T>
            <QueryChips query={parsed} />
          </View>
          <Section title={t('assistant.exact', { count: result.exact.length })}>
            {result.exact.length === 0 ? <T color={colors.muted}>{t('assistant.noExact')}</T> : result.exact.map((l) => <ListingCard key={l.id} listing={l} />)}
          </Section>
          {result.near.length > 0 ? (
            <Section title={t('assistant.near')}>
              <T variant="caption" color={colors.muted}>{t('assistant.nearHint')}</T>
              {result.near.map(({ listing, missing }) => (
                <ListingCard key={listing.id} listing={listing} missing={t('assistant.missing', { what: missing.map((m) => criterionLabel(m, t)).join(', ') })} />
              ))}
            </Section>
          ) : null}
        </>
      )}
      <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
        <Icon name="shield" size={16} color={colors.muted} />
        <T variant="caption" color={colors.muted} style={{ flex: 1 }}>{t('assistant.onlyReal')}</T>
      </View>
    </Screen>
  );
}
