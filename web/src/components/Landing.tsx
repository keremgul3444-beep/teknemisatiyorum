import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { localePath, t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { apiListingsPath, cityFromSlug, citySlug, isBoatType, landingQuery } from '@/lib/queries';
import { absUrl, breadcrumbJsonLd, pageMetadata, siteUrl } from '@/lib/seo';
import type { SearchResult, SitemapData } from '@/lib/types';
import { Breadcrumbs, JsonLd, ListingGrid, Section, Unavailable } from './bits';
import { Filters } from './Filters';

/** Hazır arama sayfalarının ortak mantığı (`/satilik/[tip]` ve `/satilik/[tip]/[sehir]`). */
async function resolve(locale: Locale, tip: string, sehir?: string) {
  if (!isBoatType(tip)) notFound();
  const map = await apiGet<SitemapData>('/listings/sitemap', { revalidate: 300 }).catch(() => null);
  const cities = [...new Set((map?.facets ?? []).map((f) => f.location).filter((c): c is string => !!c))];
  const city = sehir ? cityFromSlug(sehir, cities) : null;
  if (sehir && !city) notFound();
  const count = map?.facets.find((f) => f.type === tip && f.location === (city ?? null))?.count ?? 0;
  const typeName = t(locale, `boatType.${tip}`);
  const title = city ? t(locale, 'landing.titleCity', { type: typeName, city }) : t(locale, 'landing.title', { type: typeName });
  const path = city ? `/satilik/${tip}/${citySlug(city)}` : `/satilik/${tip}`;
  return { tip, city, count, title, path, typeName };
}

export async function landingMetadata(locale: Locale, tip: string, sehir?: string): Promise<Metadata> {
  const r = await resolve(locale, tip, sehir);
  return pageMetadata({
    title: t(locale, 'seo.pageTitle', { title: r.title }),
    description: t(locale, 'landing.description', { title: r.title, n: r.count }),
    path: r.path, locale,
    // Az ilanlı sayfa Google'a kapalı (içi boş sayfa sıralamayı düşürür).
    noindex: r.count < 3,
  });
}

export async function LandingPage({ locale, tip, sehir }: { locale: Locale; tip: string; sehir?: string }) {
  const r = await resolve(locale, tip, sehir);
  const state = { q: landingQuery(r.tip, r.city ?? undefined), sort: 'new' as const, page: 1, urgent: false };
  const res = await apiGet<SearchResult>(apiListingsPath(state), { revalidate: 300 }).catch(() => null);
  const site = siteUrl();
  const crumbs = [
    { name: t(locale, 'nav.listings'), href: localePath(locale, '/ilanlar') },
    { name: r.typeName, href: r.city ? localePath(locale, `/satilik/${r.tip}`) : undefined },
    ...(r.city ? [{ name: r.city }] : []),
  ];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: c.href ? `${site}${c.href}` : absUrl(site, locale, r.path) })))} />
      <Breadcrumbs items={crumbs} />
      <section className="section">
        <h1>{r.title}</h1>
        <p className="muted">{t(locale, 'landing.intro', { title: r.title, n: r.count })}</p>
        <Filters locale={locale} state={state} />
      </section>
      {!res ? <Unavailable locale={locale} /> : (
        <>
          {res.featuredTop.length ? <Section title={t(locale, 'home.showcase')}><ListingGrid items={res.featuredTop} locale={locale} /></Section> : null}
          <Section title={t(locale, 'listings.count', { n: res.total })}>
            {res.items.length ? <ListingGrid items={res.items} locale={locale} priorityFirst /> : <p className="muted">{t(locale, 'listings.empty')}</p>}
          </Section>
        </>
      )}
    </>
  );
}
