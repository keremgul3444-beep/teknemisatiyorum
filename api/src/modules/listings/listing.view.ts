import type { Listing, ListingPhoto, LogbookEntry, PriceHistory, User } from '@prisma/client';
import { shortName } from '@tms/shared';
import { entryView } from '../boats/logbook.service';
import { env } from '../../config/env';
import { isActive } from '../promotions/promotion.rules';

export type ListingRow = Listing & {
  photos: ListingPhoto[];
  owner: Pick<User, 'id' | 'name' | 'createdAt' | 'deletedAt' | 'verifyLevel'>;
  boat: { id: string; entries: LogbookEntry[]; _count: { entries: number } } | null;
  priceHistory: PriceHistory[];
};
/** İndirim hesabı için okunan fiyat geçmişi: haftada 3 değişiklikle 60 günlük pencere buna sığar. */
export const PRICE_HISTORY_TAKE = 30;
export const listingInclude = {
  photos: { orderBy: { order: 'asc' as const } },
  owner: { select: { id: true, name: true, createdAt: true, deletedAt: true, verifyLevel: true } },
  boat: { select: { id: true, _count: { select: { entries: true } }, entries: { orderBy: { date: 'desc' as const }, take: 10 } } },
  priceHistory: { orderBy: { at: 'desc' as const }, take: PRICE_HISTORY_TAKE },
};

/** "Fiyat düştü" bu kadar gün görünür. */
export const PRICE_DROP_DAYS = 30;
/** İndirim, son değişiklikten önceki bu kadar günde ilanın taşıdığı en düşük fiyata göre ölçülür. */
export const PRICE_REF_DAYS = 60;
/** Haftada en fazla bu kadar fiyat değişikliği; böylece referans penceresindeki tüm değişiklikler aşağıdaki sayıya sığar. */
export const PRICE_CHANGES_PER_WEEK = 3;

/**
 * Son fiyat değişikliği gerçek bir indirimse ve tazeyse: önceki fiyat ve indirim anı; değilse null.
 * "Önceki fiyat", son değişiklikten önceki 60 günde ilanın taşıdığı en düşük fiyattır: önce artırıp sonra
 * indirerek (100.000 → 200.000 → 150.000) sahte "fiyat düştü" rozeti alınamaz.
 */
export function priceDropOf(l: Pick<ListingRow, 'price' | 'currency' | 'priceHistory'>, now = new Date()) {
  const h = l.priceHistory?.[0];
  if (!h || h.currency !== l.currency || now.getTime() - h.at.getTime() > PRICE_DROP_DAYS * 864e5) return null;
  const from = h.at.getTime() - PRICE_REF_DAYS * 864e5;
  const ref = l.priceHistory.filter((x) => x.at.getTime() >= from && x.currency === l.currency).map((x) => x.price);
  const previousPrice = Math.min(...ref);
  if (!(previousPrice > l.price)) return null;
  return { previousPrice, at: h.at.toISOString() };
}

/** Ölçüsüz fiyat değişikliği onaya düşer; kural istemcilerle ortak (`shared/filter.ts`). */
export { PRICE_ONLY_RANGE, priceNeedsReview } from '@tms/shared';

/** İstemciye dönen ilan görünümü. Satıcının iletişim bilgisi bilerek yoktur; iletişim uygulama içi mesajla. */
export type ListingStats = { views: number; favorites: number; messages: number };

export function listingView(l: ListingRow, viewerId?: string, companyName?: string | null, stats?: ListingStats) {
  return {
    id: l.id,
    /** Sitedeki ilan sayfası (paylaşım için); site kısa adresi asıl adrese yönlendirir. */
    webUrl: `${env().WEB_URL}/ilan/${l.id}`,
    brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, type: l.type,
    price: l.price, currency: l.currency, location: l.location, equipment: l.equipment,
    cabins: l.cabins, engine: l.engine, description: l.description, descriptionEn: l.descriptionEn ?? null, videoUrl: l.videoUrl ?? null,
    engineHours: l.engineHours, flag: l.flag, tradeIn: l.tradeIn, negotiable: l.negotiable,
    status: l.status, badges: l.badges, rejectReason: viewerId === l.ownerId ? l.rejectReason : undefined,
    rejectNote: viewerId === l.ownerId ? l.rejectNote : undefined,
    /** Sahibine: yayındaki ilanın onay bekleyen düzenlemesi var mı. */
    pendingEdit: viewerId === l.ownerId ? !!l.pendingAt : undefined,
    removedReason: viewerId === l.ownerId ? l.removedReason : undefined,
    /** Yayın bitişi yalnızca sahibine (ne zaman yenileyeceğini bilsin). */
    expiresAt: viewerId === l.ownerId ? l.expiresAt?.toISOString() ?? null : undefined,
    photos: l.photos.map((p) => ({ id: p.fileId, url: `${env().PUBLIC_URL}/media/${p.fileId}` })),
    seller: {
      id: l.owner.id,
      // Başkalarına ad + soyadın baş harfi; tam ad yalnızca sahibine.
      name: l.owner.deletedAt ? null : viewerId === l.ownerId ? l.owner.name : shortName(l.owner.name),
      since: l.owner.createdAt.getFullYear(),
      companyName: companyName ?? null,
      /** Satıcı kimliğini doğrulattı mı (seviye 2+); "Doğrulanmış" rozeti yalnızca bu durumda gösterilir. */
      verified: !l.owner.deletedAt && l.owner.verifyLevel >= 2,
    },
    /** Bağlı teknenin karne özeti: kayıt sayısı ve en yeni iki kayıt. */
    logbook: l.boat ? { count: l.boat._count.entries, latest: publicEntries(l, viewerId).map(entryView), boatId: viewerId === l.ownerId ? l.boat.id : undefined } : null,
    /** Öne çıkarma durumu; bitiş tarihleri yalnızca sahibine (ne zaman yenileyeceğini bilsin). */
    promo: promoView(l, viewerId),
    priceDrop: priceDropOf(l),
    isMine: !!viewerId && viewerId === l.ownerId,
    /** Satıcı istatistikleri: yalnızca ilan sahibine (İlanlarım). */
    ...(stats && viewerId === l.ownerId ? { stats } : {}),
    createdAt: l.createdAt, publishedAt: l.publishedAt,
  };
}

/**
 * Karne kayıtları sahibinin serbest metnidir: başkalarına yalnızca doğrulanmış kayıtlar ve ilanın son onayından
 * önce yazılanlar (moderatörün gördükleri) gösterilir. Onaydan sonra eklenen kayıt bir sonraki onaya kadar yalnızca sahibine görünür.
 */
export function publicEntries(l: Pick<ListingRow, 'ownerId' | 'publishedAt' | 'boat'>, viewerId?: string): LogbookEntry[] {
  const entries = l.boat?.entries ?? [];
  const seen = viewerId === l.ownerId ? entries : entries.filter((e) => e.verified || (!!l.publishedAt && e.createdAt <= l.publishedAt));
  return seen.slice(0, 2);
}

function promoView(l: ListingRow, viewerId?: string, now = new Date()) {
  const own = !!viewerId && viewerId === l.ownerId;
  return {
    featured: isActive(l.featuredUntil, now),
    urgent: isActive(l.urgentUntil, now),
    ...(own ? { featuredUntil: l.featuredUntil?.toISOString(), urgentUntil: l.urgentUntil?.toISOString() } : {}),
  };
}
