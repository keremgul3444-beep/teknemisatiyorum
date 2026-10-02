import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Chip, EmptyState, FilterSheet, Header, ListingCard, MapPreview, QueryChips, Screen, Segmented, T, showDemoToast } from '@/components';
import { actions, toTRY, useListings } from '@/services';
import { isEmptyQuery, matchListings, queryToText, type ParsedQuery } from '@tms/shared';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

type Sort = 'new' | 'asc' | 'desc';

export default function Ilanlar() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ konum?: string }>();
  const [query, setQuery] = useState<ParsedQuery>({ equipment: [], location: params.konum });
  const [sort, setSort] = useState<Sort>('new');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [sheet, setSheet] = useState(false);
  const listings = useListings();

  const results = useMemo(() => {
    const r = matchListings(listings, query).exact;
    if (sort === 'new') return r;
    const dir = sort === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => dir * (toTRY(a.price, a.currency) - toTRY(b.price, b.currency)));
  }, [listings, query, sort]);
  const withoutLocation = useMemo(() => matchListings(listings, { ...query, location: undefined }).exact, [listings, query]);

  return (
    <Screen>
      <Header title={t('listings.title')} subtitle={t('listings.count', { count: results.length })}
        right={<Button small icon="filter" variant="secondary" title={t('common.filter')} onPress={() => setSheet(true)} />} />
      {!isEmptyQuery(query) ? <QueryChips query={query} /> : null}
      <Segmented options={[{ key: 'list', label: t('listings.list') }, { key: 'map', label: t('listings.map') }]} value={view} onChange={setView} />

      {view === 'map' ? (
        <>
          <T variant="caption" color={colors.muted}>{t('listings.mapHint')}</T>
          <MapPreview listings={withoutLocation} selected={query.location} onSelect={(city) => setQuery((s) => ({ ...s, location: city }))} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: space(2), flexWrap: 'wrap' }}>
          {([['new', 'sortNew'], ['asc', 'sortPriceAsc'], ['desc', 'sortPriceDesc']] as const).map(([k, label]) => (
            <Chip key={k} label={t(`listings.${label}`)} selected={sort === k} onPress={() => setSort(k)} />
          ))}
        </View>
      )}

      {results.length === 0 ? (
        <EmptyState icon="search" title={t('listings.empty')} body={t('listings.emptyBody')} actionLabel={t('common.clear')} onAction={() => setQuery({ equipment: [] })} />
      ) : (
        results.map((l) => <ListingCard key={l.id} listing={l} />)
      )}
      {!isEmptyQuery(query) ? <Button variant="ghost" icon="bell" title={t('assistant.save')} onPress={() => {
        if (!requireLevel(1)) return;
        attempt(async () => { await actions.saveSearch(queryToText(query), query); return true; }).then((ok) => ok && showDemoToast(t('assistant.saved')));
      }} /> : null}

      <FilterSheet visible={sheet} value={query} onClose={() => setSheet(false)} onApply={(q) => { setQuery(q); setSheet(false); }} />
    </Screen>
  );
}
