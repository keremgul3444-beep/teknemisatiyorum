import type { MetadataRoute } from 'next';
import { listingSlug } from './format';
import { STATIC_PAGES } from './pages';
import { citySlug } from './queries';
import { absUrl } from './seo';
import type { SitemapData } from './types';

/** Hazır arama sayfası ancak bu kadar ilan varsa Google'a açılır (içi boş sayfa sıralamayı düşürür). */
export const LANDING_MIN = 3;

export function buildSitemap(d: SitemapData, site: string): MetadataRoute.Sitemap {
  const entry = (p: string, lastModified?: string, priority = 0.5): MetadataRoute.Sitemap[number] => ({
    url: absUrl(site, 'tr', p),
    lastModified,
    priority,
    alternates: { languages: { tr: absUrl(site, 'tr', p), en: absUrl(site, 'en', p) } },
  });
  return [
    entry('/', undefined, 1),
    entry('/ilanlar', undefined, 0.9),
    ...d.listings.map((l) => entry(`/ilan/${listingSlug(l)}`, l.updatedAt, 0.8)),
    ...d.facets
      .filter((f) => f.count >= LANDING_MIN)
      .map((f) => entry(f.location ? `/satilik/${f.type}/${citySlug(f.location)}` : `/satilik/${f.type}`, undefined, 0.7)),
    ...STATIC_PAGES.filter((p) => p.indexable).map((p) => entry(p.path, undefined, 0.4)),
  ];
}
