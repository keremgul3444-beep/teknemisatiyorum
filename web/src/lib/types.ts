import type { Currency } from '@tms/shared';

/** API'nin ilan görünümü (api/src/modules/listings/listing.view.ts). */
export type ListingView = {
  id: string; brand: string; model: string; year: number; lengthM: number; type: string; price: number; currency: Currency;
  location: string; equipment: string[]; cabins?: number; engine?: string; description: string; status: string; badges: string[];
  photos: { id: string; url: string }[];
  seller: { id: string; name: string | null; since: number; companyName: string | null };
  logbook?: { count: number; latest: { id: string; title: string; date: string; kind: string; verified: boolean }[] } | null;
  promo: { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string };
  publishedAt?: string | null;
};
export type SearchResult = { items: ListingView[]; total: number; featuredTop: ListingView[] };
export type Showcase = { featured: ListingView[]; urgent: ListingView[] };
export type SitemapData = {
  listings: { id: string; brand: string; model: string; year: number; type: string; location: string; updatedAt: string }[];
  facets: { type: string; location: string | null; count: number }[];
};
