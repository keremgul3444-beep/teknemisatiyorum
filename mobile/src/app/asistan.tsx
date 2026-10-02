import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { AssistantInput, Button, Chip, EmptyState, Header, Icon, ListingCard, QueryChips, Screen, Section, T, showDemoToast } from '@/components';
import { actions, useListings, type AssistantResult } from '@/services';
import { criterionLabel, isEmptyQuery } from '@tms/shared';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

export default function Asistan() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ q?: string }>();
  const [draft, setDraft] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const listings = useListings();
  // Sonuç hangi sorgu ve ilan listesi için alındıysa onunla saklanır; "yükleniyor" bundan türetilir.
  const [fetched, setFetched] = useState<{ q: string; listings: unknown; r: AssistantResult | null } | null>(null);
  useEffect(() => {
    if (!q.trim()) return;
    let alive = true;
    attempt(() => actions.assistantSearch(q)).then((r) => { if (alive) setFetched({ q, listings, r: r ?? null }); });
    return () => { alive = false; };
  }, [q, listings]);
  const current = !!q.trim() && fetched?.q === q && fetched.listings === listings;
  const result = current ? fetched!.r : null;
  const loading = !!q.trim() && !current;
  const parsed = result?.query ?? { equipment: [] };
  const empty = !loading && (!result || isEmptyQuery(result.query));

  const save = async () => {
    if (!requireLevel(1)) return;
    const ok = await attempt(async () => { await actions.saveSearch(q, result?.query); return true; });
    if (ok) showDemoToast(t('assistant.saved'));
  };

  return (
    <Screen footer={!empty ? <Button icon="bell" title={t('assistant.save')} onPress={save} /> : undefined}>
      <Header title={t('assistant.title')} />
      <AssistantInput value={draft} onChangeText={setDraft} onSubmit={() => setQ(draft)} placeholder={t('assistant.placeholder')}
        label={t('assistant.label')} buttonLabel={t('assistant.search')} />

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: space(8) }} /> : empty ? (
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
          <Section title={t('assistant.exact', { count: result!.exact.length })}>
            {result!.exact.length === 0 ? <T color={colors.muted}>{t('assistant.noExact')}</T> : result!.exact.map((l) => <ListingCard key={l.id} listing={l} />)}
          </Section>
          {result!.near.length > 0 ? (
            <Section title={t('assistant.near')}>
              <T variant="caption" color={colors.muted}>{t('assistant.nearHint')}</T>
              {result!.near.map(({ listing, missing }) => (
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
