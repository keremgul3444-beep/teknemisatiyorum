import Link from 'next/link';
import type { Metadata } from 'next';
import type { Rates } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { listingSlug } from '@/lib/format';
import { COMPARE_MAX, compareRows } from '@/lib/compare';
import type { ListingView } from '@/lib/types';

type P = { params: Promise<{ locale: string }>; searchParams: Promise<{ ids?: string }> };

export async function generateMetadata({ params }: Pick<P, 'params'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return { title: t(locale, 'seo.pageTitle', { title: t(locale, 'compare.title') }), robots: { index: false, follow: true } };
}

/** 2–3 ilan yan yana: her satırda en iyi değer işaretli (uygulamadakiyle aynı kural). */
export default async function Karsilastir({ params, searchParams }: P) {
  const { locale } = (await params) as { locale: Locale };
  const ids = [...new Set(((await searchParams).ids ?? '').split(',').filter((x) => /^[a-z0-9]{8,40}$/i.test(x)))].slice(0, COMPARE_MAX);
  const [found, rates] = await Promise.all([
    Promise.all(ids.map((id) => apiGet<ListingView>(`/listings/${id}`, { revalidate: 60, noCount: true }).catch(() => null))),
    apiGet<Rates>('/fx', { revalidate: 300 }),
  ]);
  const ls = found.filter((l): l is ListingView => !!l);
  const tt = (k: string, p?: Record<string, string | number>) => t(locale, k, p ?? {});
  return (
    <section className="section">
      <h1>{t(locale, 'compare.title')}</h1>
      {ls.length < 2 ? <p className="muted">{t(locale, ls.length ? 'compare.needTwo' : 'compare.empty')} <Link href={localePath(locale, '/hesabim/favoriler')}>{t(locale, 'account.favorites')}</Link></p> : (
        <>
          <p className="muted small">{t(locale, 'compare.legend')}</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="small" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th scope="col" />
                  {ls.map((l) => <th key={l.id} scope="col" style={{ textAlign: 'left', padding: 8 }}><Link href={localePath(locale, `/ilan/${listingSlug(l)}`)}>{l.brand} {l.model}</Link></th>)}
                </tr>
              </thead>
              <tbody>
                {compareRows(ls, tt, locale, rates).map((r) => (
                  <tr key={r.key} style={{ borderTop: '1px solid var(--c-line)' }}>
                    <th scope="row" style={{ textAlign: 'left', padding: 8, fontWeight: 600 }}>{r.label}</th>
                    {r.values.map((v, i) => (
                      <td key={i} style={{ padding: 8, color: r.best === i ? 'var(--c-success)' : undefined, fontWeight: r.best === i ? 700 : undefined }}>
                        {v}{r.best === i ? <span className="sr-only"> ({t(locale, 'compare.best')})</span> : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
