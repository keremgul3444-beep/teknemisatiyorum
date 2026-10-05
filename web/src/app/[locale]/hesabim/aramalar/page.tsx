import type { Metadata } from 'next';
import type { ParsedQuery } from '@tms/shared';
import { localePath, t, tDict, type Locale } from '@/i18n';
import { authedGet } from '@/lib/auth-server';
import { queryToSearchParams } from '@/lib/queries';
import { SavedSearchActions } from '@/components/AccountLists';

type P = { params: Promise<{ locale: string }> };
type Row = { id: string; text: string; filter: ParsedQuery; newMatches: number };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'account.searches') }), robots: { index: false, follow: false } };
}

/** Kayıtlı aramalar: son bakıştan sonra gelen yeni ilan sayısı; yeni ilan yayına girince bildirim de gider. */
export default async function Aramalar({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const rows = await authedGet<Row[]>(locale, '/saved-searches', '/hesabim/aramalar');
  const href = (q: ParsedQuery) => {
    const sp = new URLSearchParams(queryToSearchParams({ q, sort: 'new', page: 1, urgent: false })).toString();
    return `${localePath(locale, '/ilanlar')}${sp ? `?${sp}` : ''}`;
  };
  return (
    <section className="section" style={{ maxWidth: 820 }}>
      <h1>{t(locale, 'account.searches')}</h1>
      <p className="muted">{t(locale, 'account.searchesBody')}</p>
      {rows.length === 0 ? <p className="muted">{t(locale, 'account.noSearches')}</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((s) => (
            <div key={s.id} className="card spread">
              <div style={{ minWidth: 0 }}>
                <strong>{s.text}</strong>
                {s.newMatches ? <div><span className="pill urgent">{t(locale, 'account.newMatches', { n: s.newMatches })}</span></div> : null}
              </div>
              <SavedSearchActions id={s.id} resultsHref={href(s.filter)} errors={tDict(locale, 'errors')}
                L={{ see: t(locale, 'account.seeResults'), remove: t(locale, 'account.remove') }} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
