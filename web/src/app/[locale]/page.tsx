import Link from 'next/link';
import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { apiGet } from '@/lib/api';
import { citySlug } from '@/lib/queries';
import { organizationJsonLd, pageMetadata, websiteJsonLd } from '@/lib/seo';
import type { SearchResult, Showcase, SitemapData } from '@/lib/types';
import { JsonLd, ListingGrid, SearchBox, Section, Unavailable } from '@/components/bits';

// Vitrin 1 dk'da tazelenir: satılan ilan ana sayfada en çok 1-2 dakika kalır.
export const revalidate = 60;
type P = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return pageMetadata({ title: t(locale, 'seo.homeTitle'), description: t(locale, 'seo.homeDescription'), path: '/', locale });
}

export default async function Home({ params }: P) {
  const { locale } = (await params) as { locale: Locale };
  const [show, latest, map] = await Promise.all([
    apiGet<Showcase>('/listings/showcase', { revalidate: 60 }).catch(() => null),
    apiGet<SearchResult>('/listings?sort=new', { revalidate: 300 }).catch(() => null),
    apiGet<SitemapData>('/listings/sitemap', { revalidate: 300 }).catch(() => null),
  ]);
  const shortcuts = (map?.facets ?? []).filter((f) => f.count >= 1).sort((a, b) => b.count - a.count).slice(0, 8);
  const p = (x: string) => localePath(locale, x);
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={organizationJsonLd()} />
      <section className="section">
        <h1>{t(locale, 'home.title')}</h1>
        <p className="muted">{t(locale, 'home.subtitle')}</p>
        <SearchBox locale={locale} />
      </section>
      {!show && !latest ? <Unavailable locale={locale} /> : null}
      {show?.featured.length ? (
        <Section title={t(locale, 'home.showcase')}><ListingGrid items={show.featured} locale={locale} strip priorityFirst /></Section>
      ) : null}
      {show?.urgent.length ? (
        <Section title={t(locale, 'home.urgent')} action={<Link href={`${p('/ilanlar')}?acil=1`}>{t(locale, 'home.seeAll')}</Link>}>
          <ListingGrid items={show.urgent} locale={locale} strip />
        </Section>
      ) : null}
      {show?.priceDrops?.length ? (
        <Section title={t(locale, 'home.priceDrops')} action={<Link href={`${p('/ilanlar')}?dusen=1`}>{t(locale, 'home.seeAll')}</Link>}>
          <ListingGrid items={show.priceDrops} locale={locale} strip />
        </Section>
      ) : null}
      {latest?.items.length ? (
        <Section title={t(locale, 'home.latest')} action={<Link href={p('/ilanlar')}>{t(locale, 'home.seeAll')}</Link>}>
          <ListingGrid items={latest.items.slice(0, 8)} locale={locale} priorityFirst={!show?.featured.length} />
        </Section>
      ) : null}
      {shortcuts.length ? (
        <Section title={t(locale, 'home.shortcuts')}>
          <div className="row">
            {shortcuts.map((f) => {
              const href = f.location ? `/satilik/${f.type}/${citySlug(f.location)}` : `/satilik/${f.type}`;
              const label = f.location ? `${t(locale, `boatType.${f.type}`)} · ${f.location}` : t(locale, `boatType.${f.type}`);
              return <Link key={href} className="chip" href={p(href)}>{label} ({f.count})</Link>;
            })}
          </div>
        </Section>
      ) : null}
      <Section title={t(locale, 'home.servicesTitle')}>
        <div className="grid">
          <Link href={p('/ekspertiz')} className="card"><h3>{t(locale, 'nav.expertise')}</h3><p className="muted">{t(locale, 'home.expertiseBody')}</p></Link>
          <Link href={p('/broker')} className="card"><h3>{t(locale, 'nav.broker')}</h3><p className="muted">{t(locale, 'home.brokerBody')}</p></Link>
          <Link href={p('/tekne-karnesi')} className="card"><h3>{t(locale, 'nav.logbook')}</h3><p className="muted">{t(locale, 'home.logbookBody')}</p></Link>
        </div>
      </Section>
      <Section title={t(locale, 'home.appTitle')}><p className="muted">{t(locale, 'home.appBody')}</p></Section>
    </>
  );
}
