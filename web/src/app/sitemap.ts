import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import { siteUrl } from '@/lib/seo';
import { buildSitemap } from '@/lib/sitemap';
import type { SitemapData } from '@/lib/types';

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await apiGet<SitemapData>('/listings/sitemap', { revalidate: 60 }).catch(() => ({ listings: [], facets: [] }));
  // Belgesi onaylı usta ve kaptan profilleri (her iki dilde).
  const providers = (await Promise.all((['usta', 'kaptan'] as const).map((k) =>
    apiGet<{ id: string; kind: 'usta' | 'kaptan' }[]>(`/providers?kind=${k}`, { revalidate: 300 }).catch(() => [])))).flat();
  const base = siteUrl();
  const profiles: MetadataRoute.Sitemap = providers.flatMap((p) => ['', '/en'].map((pre) => ({ url: `${base}${pre}/${p.kind}/${p.id}`, changeFrequency: 'weekly' as const, priority: 0.5 })));
  return [...buildSitemap(data, base), ...profiles];
}
