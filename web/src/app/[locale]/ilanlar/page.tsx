import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { apiListingsPath, flatten, queryToSearchParams, searchParamsToQuery, type RawSearchParams, type SearchState } from '@/lib/queries';
import { pageMetadata } from '@/lib/seo';
import type { SearchResult } from '@/lib/types';
import { ListingGrid, Section, Unavailable } from '@/components/bits';
import { Filters } from '@/components/Filters';
import { SaveSearchButton } from '@/components/AccountLists';
import { describeQuery } from '@/lib/notifications';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const s = searchParamsToQuery(flatten(await searchParams));
  // Filtreli sayısız adres çeşidi yerine asıl adres yalnızca sayfa numarasıyla (kopya sayfa önlemi).
  const path = s.page > 1 ? `/ilanlar?sayfa=${s.page}` : '/ilanlar';
  return pageMetadata({ title: t(locale, 'seo.pageTitle', { title: t(locale, 'listings.title') }), description: t(locale, 'listings.description'), path, locale });
}

export default async function Ilanlar({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const state = searchParamsToQuery(flatten(await searchParams));
  const r = await apiGet<SearchResult>(apiListingsPath(state), { revalidate: 60 }).catch(() => null);
  return (
    <>
      <section className="section">
        <h1>{t(locale, 'listings.title')}</h1>
        <Filters locale={locale} state={state} />
        <div style={{ marginTop: 12 }}>
          <SaveSearchButton text={describeQuery(state.q, locale, tDict(locale, 'boatType'), t(locale, 'account.anyListing'))} filter={state.q}
            L={{ save: t(locale, 'listings.saveSearch'), saved: t(locale, 'listings.searchSaved'), savedLink: t(locale, 'listings.searchSavedLink') }}
            errors={tDict(locale, 'errors')} loginHref={localePath(locale, '/giris')} listHref={localePath(locale, '/hesabim/aramalar')} />
        </div>
      </section>
      {!r ? <Unavailable locale={locale} /> : (
        <>
          {r.featuredTop.length ? <Section title={t(locale, 'home.showcase')}><ListingGrid items={r.featuredTop} locale={locale} priorityFirst /></Section> : null}
          <Section title={t(locale, 'listings.count', { n: r.total })}>
            {r.items.length ? <ListingGrid items={r.items} locale={locale} priorityFirst={!r.featuredTop.length} /> : <p className="muted">{t(locale, 'listings.empty')}</p>}
          </Section>
          <Pager locale={locale} state={state} total={r.total} />
        </>
      )}
    </>
  );
}

function Pager({ locale, state, total }: { locale: Locale; state: SearchState; total: number }) {
  const pages = Math.ceil(total / 20);
  if (pages <= 1) return null;
  const href = (page: number) => `${localePath(locale, '/ilanlar')}?${new URLSearchParams(queryToSearchParams({ ...state, page })).toString()}`;
  return (
    <nav className="spread" aria-label={t(locale, 'listings.pages')}>
      {state.page > 1 ? <Link rel="prev" href={href(state.page - 1)}>{t(locale, 'listings.prev')}</Link> : <span />}
      <span className="muted small">{t(locale, 'listings.pageOf', { a: state.page, b: pages })}</span>
      {state.page < pages ? <Link rel="next" href={href(state.page + 1)}>{t(locale, 'listings.next')}</Link> : <span />}
    </nav>
  );
}
