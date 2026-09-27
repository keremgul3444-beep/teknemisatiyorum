import { cityFromSlug, isBoatType } from './queries';
import type { SitemapData } from './types';

export type LandingFacts = { kind: 'notFound' } | { kind: 'ok'; tip: string; city: string | null; count: number };

/**
 * Hazır arama sayfasının kararı. Veri yoksa (API'ye ulaşılamadı) "bulunamadı" DENMEZ, hata yükselir:
 * böylece önbellekteki sayfa sunulmaya devam eder, Google geçici bir aksaklıkta 404/noindex görmez.
 */
export function resolveLanding(map: SitemapData | null, tip: string, sehir?: string): LandingFacts {
  if (!map) throw new Error('Hazır arama verisi alınamadı');
  if (!isBoatType(tip)) return { kind: 'notFound' };
  const cities = [...new Set(map.facets.map((f) => f.location).filter((c): c is string => !!c))];
  const city = sehir ? cityFromSlug(sehir, cities) : null;
  if (sehir && !city) return { kind: 'notFound' };
  const count = map.facets.find((f) => f.type === tip && f.location === (city ?? null))?.count ?? 0;
  return { kind: 'ok', tip, city, count };
}
