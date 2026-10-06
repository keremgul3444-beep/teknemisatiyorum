import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { criterionLabel, isEmptyQuery, queryChips, type Criterion, type ParsedQuery } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { queryToSearchParams } from '@/lib/queries';
import { SaveSearchButton } from '@/components/AccountLists';
import { apiSend } from '@/lib/api';
import { clientIpFromHeader } from '@/lib/session';
import type { ListingView } from '@/lib/types';
import { ListingCard } from '@/components/ListingCard';
import { ListingGrid, SearchBox, Section, Unavailable } from '@/components/bits';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> };
type Result = { query: ParsedQuery; source: string; exact: ListingView[]; near: { listing: ListingView; missing: Criterion[] }[] };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'assistant.title') }), robots: { index: false, follow: true } };
}

/** Akıllı Asistan sonuçları. Misafir kotası ziyaretçi IP'sine göre işler (site gerçek IP'yi iletir). */
export default async function Asistan({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 500) ?? '';
  const ip = clientIpFromHeader((await headers()).get('x-forwarded-for'));
  const r = q ? await apiSend<Result>('POST', '/assistant/search', { text: q }, { ip }).catch(() => null) : null;
  const tt = (key: string, p?: Record<string, unknown>) => t(locale, key, p as Record<string, string | number>);
  return (
    <>
      <section className="section">
        <h1>{t(locale, 'assistant.title')}</h1>
        <SearchBox locale={locale} defaultValue={q} />
        {r ? <div className="row" style={{ marginTop: 12 }}>{queryChips(r.query, tt, locale).map((c) => <span key={c} className="chip">{c}</span>)}</div> : null}
        {/* Anlaşılan arama kaydedilebilir ya da süzgeçlerde açılıp ince ayar yapılabilir. */}
        {r && !isEmptyQuery(r.query) ? (
          <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
            <SaveSearchButton text={q.slice(0, 300)} filter={r.query}
              L={{ save: t(locale, 'listings.saveSearch'), saved: t(locale, 'listings.searchSaved'), savedLink: t(locale, 'listings.searchSavedLink') }}
              errors={tDict(locale, 'errors')} loginHref={localePath(locale, '/giris')} listHref={localePath(locale, '/hesabim/aramalar')} />
            <Link className="small" href={`${localePath(locale, '/ilanlar')}?${new URLSearchParams(queryToSearchParams({ q: r.query, sort: 'new', page: 1, urgent: false }))}`}>{t(locale, 'assistant.openFilters')}</Link>
          </div>
        ) : null}
      </section>
      {q && !r ? <Unavailable locale={locale} /> : null}
      {r ? (
        <>
          <Section title={t(locale, 'assistant.exact', { n: r.exact.length })}>
            {r.exact.length ? <ListingGrid items={r.exact} locale={locale} priorityFirst /> : <p className="muted">{t(locale, 'assistant.noExact')}</p>}
          </Section>
          {r.near.length ? (
            <Section title={t(locale, 'assistant.near')}>
              <div className="grid">
                {r.near.map(({ listing, missing }) => (
                  <div key={listing.id}>
                    <ListingCard listing={listing} locale={locale} />
                    <p className="small muted">{t(locale, 'assistant.missing', { what: missing.map((m) => criterionLabel(m, tt)).join(', ') })}</p>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
