import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import { siteUrl } from '@/lib/seo';
import { buildSitemap } from '@/lib/sitemap';
import type { SitemapData } from '@/lib/types';

export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await apiGet<SitemapData>('/listings/sitemap', { revalidate: 600 }).catch(() => ({ listings: [], facets: [] }));
  return buildSitemap(data, siteUrl());
}
