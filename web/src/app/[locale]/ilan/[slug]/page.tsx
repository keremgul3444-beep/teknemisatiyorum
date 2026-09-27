import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { toTRY, type Currency, type Rates } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { ApiError, apiGet } from '@/lib/api';
import { formatPrice, idFromSlug, listingSlug, mediaUrl } from '@/lib/format';
import { apiListingsPath, citySlug, landingQuery } from '@/lib/queries';
import { breadcrumbJsonLd, listingJsonLd, listingMetadata, siteUrl } from '@/lib/seo';
import type { ListingView, SearchResult } from '@/lib/types';
import { AppLink, Breadcrumbs, JsonLd, ListingGrid, Section } from '@/components/bits';
import { PromoBadges } from '@/components/PromoBadges';

export const revalidate = 60;
type P = { params: Promise<{ locale: string; slug: string }> };

/** Yayında değilse (kaldırıldı/silindi) null: ara katman bu adresi zaten 410 sayfasına çevirir; burası yedek. */
async function load(slug: string) {
  return apiGet<ListingView>(`/listings/${encodeURIComponent(idFromSlug(slug))}`, { revalidate: 60 }).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const l = await load(slug).catch(() => null);
  return l ? listingMetadata(l, locale) : { robots: { index: false } };
}

export default async function IlanDetay({ params }: P) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const l = await load(slug);
  if (!l) notFound();
  // Marka/model değiştiyse ya da adres eksik yazıldıysa asıl adrese kalıcı yönlendir.
  if (slug !== listingSlug(l)) permanentRedirect(localePath(locale, `/ilan/${listingSlug(l)}`));

  const [rates, similar] = await Promise.all([
    apiGet<Rates>('/fx', { revalidate: 3600 }).catch(() => null),
    apiGet<SearchResult>(apiListingsPath({ q: landingQuery(l.type, l.location), sort: 'new', page: 1, urgent: false }), { revalidate: 300 }).catch(() => null),
  ]);
  const site = siteUrl();
  const typeName = t(locale, `boatType.${l.type}`);
  const crumbs = [
    { name: t(locale, 'nav.listings'), href: localePath(locale, '/ilanlar') },
    { name: typeName, href: localePath(locale, `/satilik/${l.type}`) },
    { name: l.location, href: localePath(locale, `/satilik/${l.type}/${citySlug(l.location)}`) },
    { name: `${l.brand} ${l.model}` },
  ];
  const others = (similar?.items ?? []).filter((x) => x.id !== l.id).slice(0, 4);
  const [first, ...rest] = l.photos;
  const title = `${l.brand} ${l.model} · ${l.year}`;

  return (
    <>
      <JsonLd data={listingJsonLd(l, locale)} />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: c.href ? `${site}${c.href}` : `${site}${localePath(locale, `/ilan/${slug}`)}` })))} />
      <Breadcrumbs items={crumbs} />
      <article className="section" style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div>
          {first ? (
            <img src={mediaUrl(first.id, 1600)} srcSet={`${mediaUrl(first.id, 800)} 800w, ${mediaUrl(first.id, 1600)} 1600w`}
              sizes="(max-width: 700px) 100vw, 600px" width={1600} height={1200} alt={title} fetchPriority="high"
              style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-card)', aspectRatio: '4 / 3', objectFit: 'cover' }} />
          ) : <div className="card" style={{ aspectRatio: '4 / 3' }} />}
          {rest.length ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', marginTop: 12 }}>
              {rest.map((p) => <img key={p.id} src={mediaUrl(p.id, 400)} width={400} height={300} alt={title} loading="lazy" decoding="async" style={{ borderRadius: 'var(--r-sm)', aspectRatio: '4 / 3', objectFit: 'cover' }} />)}
            </div>
          ) : null}
        </div>
        <div>
          <PromoBadges promo={l.promo} locale={locale} />
          <h1 style={{ marginTop: 8 }}>{title}</h1>
          <p className="muted">{l.lengthM.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} m · {l.location} · {typeName}</p>
          <PriceBlock locale={locale} price={l.price} currency={l.currency} rates={rates} />
          <div className="row" style={{ margin: '16px 0' }}>
            {l.badges.map((b) => <span key={b} className="chip">{t(locale, `badge.${b}`, {})}</span>)}
            {l.status === 'sold' ? <span className="chip">{t(locale, 'listing.sold')}</span> : null}
          </div>
          <div className="row" style={{ margin: '16px 0' }}>
            <AppLink locale={locale} path={`ilan/${l.id}`}>{t(locale, 'listing.message')}</AppLink>
            <AppLink locale={locale} path="ekspertiz" secondary>{t(locale, 'listing.requestSurvey')}</AppLink>
          </div>
          <table className="card" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Spec k={t(locale, 'listing.year')} v={String(l.year)} />
              <Spec k={t(locale, 'listing.length')} v={`${l.lengthM} m`} />
              {l.cabins ? <Spec k={t(locale, 'listing.cabins')} v={String(l.cabins)} /> : null}
              {l.engine ? <Spec k={t(locale, 'listing.engine')} v={l.engine} /> : null}
              {l.equipment.length ? <Spec k={t(locale, 'listing.equipment')} v={l.equipment.map((e) => t(locale, `equipment.${e}`)).join(', ')} /> : null}
              {l.seller.companyName ? <Spec k={t(locale, 'listing.company')} v={l.seller.companyName} /> : null}
            </tbody>
          </table>
          {l.logbook?.count ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>{t(locale, 'listing.logbook', { n: l.logbook.count })}</h3>
              <ul className="small">{l.logbook.latest.map((e) => <li key={e.id}>{e.date} · {e.title.startsWith('i18n:') ? t(locale, e.title.slice(5)) : e.title}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </article>
      {l.description ? <Section title={t(locale, 'listing.description')}><p style={{ whiteSpace: 'pre-line' }}>{l.description}</p></Section> : null}
      {others.length ? <Section title={t(locale, 'listing.similar')}><ListingGrid items={others} locale={locale} /></Section> : null}
    </>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return <tr><th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{k}</th><td style={{ padding: '6px 8px' }}>{v}</td></tr>;
}

/** Fiyat ve diğer para birimlerindeki karşılığı (sunucunun kur tablosuyla). */
function PriceBlock({ locale, price, currency, rates }: { locale: Locale; price: number; currency: Currency; rates: Rates | null }) {
  const others = (['TRY', 'EUR', 'USD'] as Currency[]).filter((c) => c !== currency);
  return (
    <div>
      <strong style={{ fontSize: 28, color: 'var(--c-primary)' }}>{formatPrice(price, currency, locale)}</strong>
      {rates ? (
        <p className="muted small">≈ {others.map((c) => formatPrice(Math.round(toTRY(price, currency, rates) / rates[c]), c, locale)).join(' · ')}</p>
      ) : null}
    </div>
  );
}
