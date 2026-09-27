import type { Metadata } from 'next';
import { t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import type { SearchResult } from '@/lib/types';
import { ListingGrid, SearchBox, Section } from '@/components/bits';

// Ara katman, yayında olmayan bir ilan adresini bu sayfaya HTTP 410 ile yeniden yazar.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function IlanKalkti({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  const latest = await apiGet<SearchResult>('/listings?sort=new', { revalidate: 300 }).catch(() => null);
  return (
    <>
      <section className="section">
        <h1>{t(locale, 'gone.title')}</h1>
        <p className="muted">{t(locale, 'gone.body')}</p>
        <SearchBox locale={locale} />
      </section>
      {latest?.items.length ? <Section title={t(locale, 'home.latest')}><ListingGrid items={latest.items.slice(0, 8)} locale={locale} /></Section> : null}
    </>
  );
}
