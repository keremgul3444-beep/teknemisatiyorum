import type { Listing, ListingPhoto, User } from '@prisma/client';
import { env } from '../../config/env';

export type ListingRow = Listing & { photos: ListingPhoto[]; owner: Pick<User, 'id' | 'name' | 'createdAt' | 'deletedAt'> };
export const listingInclude = {
  photos: { orderBy: { order: 'asc' as const } },
  owner: { select: { id: true, name: true, createdAt: true, deletedAt: true } },
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
    isMine: !!viewerId && viewerId === l.ownerId,
    createdAt: l.createdAt, publishedAt: l.publishedAt,
  };
}
