import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { toTRY, type Currency, type Rates } from '@tms/shared';
import { localePath, t, type Locale } from '@/i18n';
import { ApiError, apiGet } from '@/lib/api';
import { formatPrice, idFromSlug, listingSlug, mediaUrl } from '@/lib/format';
import { apiListingsPath, citySlug, landingQuery } from '@/lib/queries';
import { breadcrumbJsonLd, listingJsonLd, listingMetadata, siteUrl } from '@/lib/seo';
import type { ListingView, SearchResult } from '@/lib/types';
import { AppLink, Breadcrumbs, JsonLd, ListingGrid, Section, appHref } from '@/components/bits';
import { ViewBeacon } from '@/components/ViewBeacon';
import { PromoBadges } from '@/components/PromoBadges';

export const revalidate = 60;
type P = { params: Promise<{ locale: string; slug: string }> };

/** Yayında değilse (kaldırıldı/silindi) null: ara katman bu adresi zaten 410 sayfasına çevirir; burası yedek. */
async function load(slug: string) {
  return apiGet<ListingView>(`/listings/${encodeURIComponent(idFromSlug(slug))}`, { revalidate: 60, noCount: true }).catch((e) => {
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
      {l.status === 'published' ? <ViewBeacon id={l.id} /> : null}
      <JsonLd data={listingJsonLd(l, locale)} />
      <JsonLd data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: c.href ? `${site}${c.href}` : `${site}${localePath(locale, `/ilan/${slug}`)}` })))} />
      <Breadcrumbs items={crumbs} />
      <article className="section" style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div>
          {first ? (
            <img src={mediaUrl(first.id, 1600)} srcSet={`${mediaUrl(first.id, 800)} 800w, ${mediaUrl(first.id, 1600)} 1600w`}
              sizes="(max-width: 700px) 100vw, 600px" width={1600} height={1200} alt={title} fetchPriority="high"
              style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-card)', aspectRatio: '4 / 3', objectFit: 'cover' }} />
          ) : <div className="card" style={{ aspectRatio: '4 / 3', background: 'linear-gradient(180deg, #BFD9EA 0 62%, #2F6F98 62% 100%)' }} aria-hidden="true" />}
          {rest.length ? (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', marginTop: 12 }}>
              {rest.map((p) => <img key={p.id} src={mediaUrl(p.id, 400)} width={400} height={300} alt={title} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-sm)', aspectRatio: '4 / 3', objectFit: 'cover' }} />)}
            </div>
          ) : null}
        </div>
        <div>
          <PromoBadges promo={l.promo} priceDrop={l.priceDrop} locale={locale} />
          <h1 style={{ marginTop: 8, marginBottom: 4 }}>{l.brand} {l.model}</h1>
          <p className="muted">{l.year} · {l.location} · {typeName}</p>
          <PriceBlock locale={locale} price={l.price} currency={l.currency} rates={rates} previous={l.priceDrop?.previousPrice} />
          {l.negotiable || l.tradeIn ? (
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {[l.negotiable ? t(locale, 'listing.negotiable') : null, l.tradeIn ? t(locale, 'listing.tradeIn') : null].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {l.badges.length || l.status === 'sold' ? (
            <div className="row" style={{ margin: '12px 0 0' }}>
              {l.badges.map((b) => <span key={b} className="pill featured">{t(locale, `badge.${b}`, {})}</span>)}
              {l.status === 'sold' ? <span className="pill urgent">{t(locale, 'listing.sold')}</span> : null}
            </div>
          ) : null}
          <div className="facts">
            <div><strong>{l.lengthM.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')} m</strong><span className="muted small">{t(locale, 'listing.length')}</span></div>
            <div><strong>{l.year}</strong><span className="muted small">{t(locale, 'listing.year')}</span></div>
            <div><strong>{l.cabins || '—'}</strong><span className="muted small">{t(locale, 'listing.cabins')}</span></div>
          </div>
          {/* Satılmış teknede alıcıya mesaj ve ekspertiz sunulmaz. */}
          {l.status === 'sold' ? (
            <p className="muted" style={{ margin: '16px 0' }}><strong>{t(locale, 'listing.soldNote')}</strong></p>
          ) : (
            <div className="row" style={{ margin: '16px 0' }}>
              <AppLink locale={locale} path={`ilan/${l.id}`}>{t(locale, 'listing.message')}</AppLink>
              <AppLink locale={locale} path={`ekspertiz?ilan=${encodeURIComponent(l.id)}`} secondary>{t(locale, 'listing.requestSurvey')}</AppLink>
            </div>
          )}
          {l.status === 'published' ? <p className="small"><a href={appHref(`bildir/${encodeURIComponent(l.id)}`)}>{t(locale, 'listing.report')}</a></p> : null}
          <table className="card specs" style={{ padding: 0 }}>
            <tbody>
              <Spec k={t(locale, 'listing.type')} v={typeName} />
              <Spec k={t(locale, 'listing.location')} v={l.location} />
              {l.engine ? <Spec k={t(locale, 'listing.engine')} v={l.engine} /> : null}
              {l.engineHours != null ? <Spec k={t(locale, 'listing.engineHours')} v={t(locale, 'listing.engineHoursValue', { hours: l.engineHours.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US') })} /> : null}
              {l.flag ? <Spec k={t(locale, 'listing.flag')} v={t(locale, l.flag === 'tr' ? 'listing.flagTr' : 'listing.flagForeign')} /> : null}
              {l.equipment.length ? <Spec k={t(locale, 'listing.equipment')} v={l.equipment.map((e) => t(locale, `equipment.${e}`)).join(', ')} /> : null}
              {l.seller.companyName ? <Spec k={t(locale, 'listing.company')} v={l.seller.companyName} /> : null}
            </tbody>
          </table>
          {l.logbook?.count ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h3>{t(locale, 'listing.logbook', { n: l.logbook.count })}</h3>
              <ul className="small">{l.logbook.latest.map((e) => <li key={e.id}>{e.date} · {logbookTitle(locale, e.title)}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </article>
      {l.description ? <Section title={t(locale, 'listing.description')}><p style={{ whiteSpace: 'pre-line' }}>{l.description}</p></Section> : null}
      {others.length ? <Section title={t(locale, 'listing.similar')}><ListingGrid items={others} locale={locale} /></Section> : null}
    </>
  );
}

/** Sunucunun yazdığı karne başlıkları yalnızca "logbook." anahtarları olabilir; geri kalan her şey kullanıcı metni olarak gösterilir. */
function logbookTitle(locale: Locale, title: string): string {
  if (!title.startsWith('i18n:logbook.')) return title;
  try {
    return t(locale, title.slice(5));
  } catch {
    return title;
  }
}

function Spec({ k, v }: { k: string; v: string }) {
  return <tr><th scope="row">{k}</th><td>{v}</td></tr>;
}

/** Fiyat ve diğer para birimlerindeki karşılığı (sunucunun kur tablosuyla). */
function PriceBlock({ locale, price, currency, rates, previous }: { locale: Locale; price: number; currency: Currency; rates: Rates | null; previous?: number }) {
  const others = (['TRY', 'EUR', 'USD'] as Currency[]).filter((c) => c !== currency);
  return (
    <div>
      <strong style={{ fontSize: 28, color: 'var(--c-primary)' }}>{formatPrice(price, currency, locale)}</strong>
      {previous ? <s className="muted" style={{ marginLeft: 10, fontSize: 16 }} aria-label={t(locale, 'listing.previousPrice', { price: formatPrice(previous, currency, locale) })}>{formatPrice(previous, currency, locale)}</s> : null}
      {rates ? (
        <p className="muted small">≈ {others.map((c) => formatPrice(Math.round(toTRY(price, currency, rates) / rates[c]), c, locale)).join(' · ')}</p>
      ) : null}
    </div>
  );
}
