import type { Metadata } from 'next';
import { localePath, t, type Locale } from '@/i18n';
import { formatPrice, listingSlug } from './format';
import type { ListingView } from './types';

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
const SITE_NAME = 'teknemisatıyorum';

const clip = (s: string, n = 155) => {
  const c = s.replace(/\s+/g, ' ').trim();
  if (c.length <= n) return c;
  const cut = c.slice(0, n - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length)}…`;
};
/** Mutlak adres; ana sayfada sonda eğik çizgi yok. */
export const absUrl = (site: string, locale: Locale, p: string) => {
  const path = localePath(locale, p);
  return path === '/' ? site : `${site}${path}`;
};
const langs = (site: string, p: string) => ({ tr: absUrl(site, 'tr', p), en: absUrl(site, 'en', p), 'x-default': absUrl(site, 'tr', p) });

export function pageMetadata(o: { title: string; description: string; path: string; locale: Locale; noindex?: boolean; siteUrl?: string; image?: string }): Metadata {
  const site = o.siteUrl ?? siteUrl();
  const url = absUrl(site, o.locale, o.path);
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: url, languages: langs(site, o.path) },
    openGraph: {
      title: o.title, description: o.description, url, siteName: SITE_NAME, locale: o.locale === 'tr' ? 'tr_TR' : 'en_US', type: 'website',
      ...(o.image ? { images: [{ url: o.image, width: 1600 }] } : {}),
    },
    twitter: { card: o.image ? 'summary_large_image' : 'summary', title: o.title, description: o.description },
    ...(o.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export function listingMetadata(l: ListingView, locale: Locale, site = siteUrl()): Metadata {
  const name = `${l.brand} ${l.model}`;
  const title = t(locale, 'seo.listingTitle', { name, year: l.year, city: l.location, price: formatPrice(l.price, l.currency, locale), site: SITE_NAME });
  const description = clip(l.description || t(locale, 'seo.listingFallback', { name, year: l.year, city: l.location, length: l.lengthM }));
  const image = l.photos[0] ? `${site}/media/${l.photos[0].id}?w=1600` : undefined;
  return pageMetadata({ title, description, path: `/ilan/${listingSlug(l)}`, locale, siteUrl: site, image });
}

export function listingJsonLd(l: ListingView, locale: Locale, site = siteUrl()) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${l.brand} ${l.model} (${l.year})`,
    brand: { '@type': 'Brand', name: l.brand },
    image: l.photos.map((p) => `${site}/media/${p.id}?w=1600`),
    description: clip(l.description || `${l.brand} ${l.model}`, 500),
    offers: {
      '@type': 'Offer',
      price: l.price,
      priceCurrency: l.currency,
      url: absUrl(site, locale, `/ilan/${listingSlug(l)}`),
      availability: l.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      areaServed: l.location,
      // KVKK: bireysel satıcının adı Google verisine konmaz; yalnızca firma adı.
      ...(l.seller.companyName ? { seller: { '@type': 'Organization', name: l.seller.companyName } } : {}),
    },
  };
}

export const breadcrumbJsonLd = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })),
});
export const organizationJsonLd = (site = siteUrl()) => ({ '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: site, logo: `${site}/icon.png` });
export const websiteJsonLd = (site = siteUrl()) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: site,
});

/** JSON-LD'yi güvenle gömmek için: `</script>` kaçışı. */
export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c');
