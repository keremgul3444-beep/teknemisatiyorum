import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { criterionLabel, queryChips, type Criterion, type ParsedQuery } from '@tms/shared';
import { t, type Locale } from '@/i18n';
import { apiSend } from '@/lib/api';
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
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const r = q ? await apiSend<Result>('POST', '/assistant/search', { text: q }, { ip }).catch(() => null) : null;
  const tt = (key: string, p?: Record<string, unknown>) => t(locale, key, p as Record<string, string | number>);
  return (
    <>
      <section className="section">
        <h1>{t(locale, 'assistant.title')}</h1>
        <SearchBox locale={locale} defaultValue={q} />
        {r ? <div className="row" style={{ marginTop: 12 }}>{queryChips(r.query, tt, locale).map((c) => <span key={c} className="chip">{c}</span>)}</div> : null}
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
