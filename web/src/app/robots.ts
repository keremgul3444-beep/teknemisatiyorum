import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/** Google'a kapalı yollar (her iki dilde): girişli alan, ödeme, asistan sonuçları, kalkan ilan sayfası. */
const CLOSED = ['/hesabim', '/odeme', '/giris', '/asistan', '/ilan-kalkti'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...CLOSED, ...CLOSED.map((p) => `/en${p}`), '/api/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
