import type { Listing, ListingPhoto, LogbookEntry, User } from '@prisma/client';
import { entryView } from '../boats/logbook.service';
import { env } from '../../config/env';
import { isActive } from '../promotions/promotion.rules';

export type ListingRow = Listing & {
  photos: ListingPhoto[];
  owner: Pick<User, 'id' | 'name' | 'createdAt' | 'deletedAt'>;
  boat: { id: string; entries: LogbookEntry[]; _count: { entries: number } } | null;
};
export const listingInclude = {
  photos: { orderBy: { order: 'asc' as const } },
  owner: { select: { id: true, name: true, createdAt: true, deletedAt: true } },
  boat: { select: { id: true, _count: { select: { entries: true } }, entries: { orderBy: { date: 'desc' as const }, take: 2 } } },
};

/** İstemciye dönen ilan görünümü. Satıcının iletişim bilgisi bilerek yoktur; iletişim uygulama içi mesajla. */
export function listingView(l: ListingRow, viewerId?: string, companyName?: string | null) {
  return {
    id: l.id,
    brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, type: l.type,
    price: l.price, currency: l.currency, location: l.location, equipment: l.equipment,
    cabins: l.cabins, engine: l.engine, description: l.description,
    status: l.status, badges: l.badges, rejectReason: viewerId === l.ownerId ? l.rejectReason : undefined,
    photos: l.photos.map((p) => ({ id: p.fileId, url: `${env().PUBLIC_URL}/media/${p.fileId}` })),
    seller: {
      id: l.owner.id,
      name: l.owner.deletedAt ? null : l.owner.name,
      since: l.owner.createdAt.getFullYear(),
      companyName: companyName ?? null,
    },
    /** Bağlı teknenin karne özeti: kayıt sayısı ve en yeni iki kayıt. */
    logbook: l.boat ? { count: l.boat._count.entries, latest: l.boat.entries.map(entryView), boatId: viewerId === l.ownerId ? l.boat.id : undefined } : null,
    /** Öne çıkarma durumu; bitiş tarihleri yalnızca sahibine (ne zaman yenileyeceğini bilsin). */
    promo: promoView(l, viewerId),
    isMine: !!viewerId && viewerId === l.ownerId,
    createdAt: l.createdAt, publishedAt: l.publishedAt,
  };
}

function promoView(l: ListingRow, viewerId?: string, now = new Date()) {
  const own = !!viewerId && viewerId === l.ownerId;
  return {
    featured: isActive(l.featuredUntil, now),
    urgent: isActive(l.urgentUntil, now),
    ...(own ? { featuredUntil: l.featuredUntil?.toISOString(), urgentUntil: l.urgentUntil?.toISOString() } : {}),
  };
}
