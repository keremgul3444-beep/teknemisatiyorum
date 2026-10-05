import type { Currency } from '@tms/shared';

/** API'nin ilan görünümü (api/src/modules/listings/listing.view.ts). */
export type ListingView = {
  id: string; brand: string; model: string; year: number; lengthM: number; type: string; price: number; currency: Currency;
  location: string; equipment: string[]; cabins?: number; engine?: string; description: string; descriptionEn?: string | null; status: string; badges: string[];
  engineHours?: number | null; flag?: 'tr' | 'foreign' | null; tradeIn?: boolean; negotiable?: boolean;
  photos: { id: string; url: string }[];
  seller: { id: string; name: string | null; since: number; companyName: string | null; verified?: boolean };
  /** Yalnızca ilan sahibine: red ve moderatörün kaldırma gerekçesi. */
  rejectReason?: string | null; removedReason?: string | null; expiresAt?: string | null;
  logbook?: { count: number; latest: { id: string; title: string; date: string; kind: string; verified: boolean }[] } | null;
  promo: { featured: boolean; urgent: boolean; featuredUntil?: string; urgentUntil?: string };
  /** Son 30 günde indirim yapıldıysa önceki fiyat ve indirim anı. */
  priceDrop?: { previousPrice: number; at: string } | null;
  /** Satıcı istatistikleri (yalnızca /me/listings). */
  stats?: { views: number; favorites: number; messages: number };
  publishedAt?: string | null;
};
export type SearchResult = { items: ListingView[]; total: number; featuredTop: ListingView[] };
export type Showcase = { featured: ListingView[]; urgent: ListingView[]; priceDrops?: ListingView[] };
export type SitemapData = {
  listings: { id: string; brand: string; model: string; year: number; type: string; location: string; updatedAt: string }[];
  facets: { type: string; location: string | null; count: number }[];
};
