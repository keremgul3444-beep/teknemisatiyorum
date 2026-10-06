import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '@/theme';
import { Button, Chip, EmptyState, FilterSheet, Header, ListingCard, MapPreview, QueryChips, Screen, Segmented, T, showDemoToast } from '@/components';
import { actions, isApiMode, toTRY, useListings, type Listing } from '@/services';
import { isEmptyQuery, matchListings, parsedQuerySchema, queryToText, type ParsedQuery } from '@tms/shared';
import { requireLevel } from '@/session/role';
import { attempt } from '@/services/errors';

type Sort = 'new' | 'asc' | 'desc';

function initialQuery(q: string | undefined, location: string | undefined): ParsedQuery {
  if (q) {
    try { return parsedQuerySchema.parse(JSON.parse(q)); } catch { /* bozuk parametre: boş arama */ }
  }
  return { equipment: [], location };
}

export default function Ilanlar() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ konum?: string; dusen?: string; q?: string }>();
  // Kayıtlı aramadan gelince kaydedilen filtre aynen uygulanır.
  const [query, setQuery] = useState<ParsedQuery>(() => initialQuery(params.q, params.konum));
  const [dropOnly, setDropOnly] = useState(params.dusen === '1');
  const [sort, setSort] = useState<Sort>('new');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [sheet, setSheet] = useState(false);
  const listings = useListings();

  // Gerçek mod: arama sunucuda (tüm ilanlar, güncel kur, tazelik sırası), sayfa sayfa.
  const api = isApiMode();
  // `key`: sonucun ait olduğu arama; ekrandaki aramayla aynı değilse yükleniyor.
  const key = JSON.stringify([query, sort, dropOnly]);
  const [remote, setRemote] = useState<{ key: string; items: Listing[]; total: number; page: number }>({ key: '', items: [], total: 0, page: 0 });
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!api) return;
    let live = true;
    void attempt(() => actions.searchListings(query, sort, 1, dropOnly)).then((r) => { if (live) setRemote({ key, items: r?.items ?? [], total: r?.total ?? 0, page: 1 }); });
    return () => { live = false; };
  }, [api, key, query, sort, dropOnly]);
  const loadMore = async () => {
    setMore(true);
    const r = await attempt(() => actions.searchListings(query, sort, remote.page + 1, dropOnly));
    setMore(false);
    if (r) setRemote((p) => (p.key === key ? { ...p, items: [...p.items, ...r.items], total: r.total, page: p.page + 1 } : p));
  };
  const loading = api && remote.key !== key;

  const local = useMemo(() => {
    const all = matchListings(listings, query).exact;
    const r = dropOnly ? all.filter((l) => l.priceDrop) : all;
    if (sort === 'new') return r;
    const dir = sort === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => dir * (toTRY(a.price, a.currency) - toTRY(b.price, b.currency)));
  }, [listings, query, sort, dropOnly]);
  const results = api ? (loading ? [] : remote.items) : local;
  const count = api ? remote.total : local.length;
  const withoutLocation = useMemo(() => matchListings(listings, { ...query, location: undefined }).exact, [listings, query]);

  return (
    <Screen>
      <Header title={t('listings.title')} subtitle={t('listings.count', { count })}
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
          <Chip label={t('listings.dropOnly')} selected={dropOnly} onPress={() => setDropOnly((v) => !v)} />
        </View>
      )}

      {loading ? null : results.length === 0 ? (
        <EmptyState icon="search" title={t('listings.empty')} body={t('listings.emptyBody')} actionLabel={t('common.clear')} onAction={() => setQuery({ equipment: [] })} />
      ) : (
        results.map((l) => <ListingCard key={l.id} listing={l} />)
      )}
      {api && !loading && results.length < remote.total ? <Button variant="secondary" title={t('listings.more')} loading={more} onPress={() => void loadMore()} /> : null}
      {!isEmptyQuery(query) ? <Button variant="ghost" icon="bell" title={t('assistant.save')} onPress={() => {
        if (!requireLevel(1)) return;
        attempt(async () => { await actions.saveSearch(queryToText(query), query); return true; }).then((ok) => ok && showDemoToast(t('assistant.saved')));
      }} /> : null}

      <FilterSheet visible={sheet} value={query} onClose={() => setSheet(false)} onApply={(q) => { setQuery(q); setSheet(false); }} />
    </Screen>
  );
}
