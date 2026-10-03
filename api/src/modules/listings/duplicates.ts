import type { PrismaService } from '../../common/prisma.service';
import { hamming, informative, SAME_PHOTO_MAX_DISTANCE } from '../media/phash';

export interface PhotoDuplicate { listingId: string; title: string; status: string; sameOwner: boolean }

/**
 * Onay bekleyen ilanların fotoğrafları başka bir ilanda (yayında, satılmış, kaldırılmış…) da var mı?
 * Başka satıcıda çıkan aynı fotoğraf çalıntı ilan işaretidir; aynı satıcıda çıkan ise mükerrer ilan.
 * Engellemez, moderatöre gösterilir. İnternetten alınmış ama sistemde olmayan fotoğrafı yakalamaz.
 */
export async function photoDuplicates(prisma: PrismaService, listingIds: string[]): Promise<Map<string, PhotoDuplicate[]>> {
  const out = new Map<string, PhotoDuplicate[]>();
  if (!listingIds.length) return out;
  const photos = await prisma.listingPhoto.findMany({ select: { listingId: true, fileId: true } });
  const files = await prisma.file.findMany({ where: { id: { in: [...new Set(photos.map((p) => p.fileId))] }, phash: { not: null } }, select: { id: true, phash: true } });
  const hashOf = new Map(files.filter((f) => f.phash && informative(f.phash)).map((f) => [f.id, f.phash!]));
  const listings = await prisma.listing.findMany({ where: { id: { in: [...new Set(photos.map((p) => p.listingId))] } }, select: { id: true, ownerId: true, brand: true, model: true, status: true } });
  const byId = new Map(listings.map((l) => [l.id, l]));
  for (const id of listingIds) {
    const me = byId.get(id);
    if (!me) continue;
    const mine = photos.filter((p) => p.listingId === id).map((p) => hashOf.get(p.fileId)).filter((h): h is string => !!h);
    const hits = new Map<string, PhotoDuplicate>();
    for (const p of photos) {
      if (p.listingId === id || hits.has(p.listingId)) continue;
      const h = hashOf.get(p.fileId);
      const other = byId.get(p.listingId);
      if (!h || !other || other.status === 'draft') continue;
      if (mine.some((m) => hamming(m, h) <= SAME_PHOTO_MAX_DISTANCE)) {
        hits.set(p.listingId, { listingId: other.id, title: `${other.brand} ${other.model}`, status: other.status, sameOwner: other.ownerId === me.ownerId });
      }
    }
    if (hits.size) out.set(id, [...hits.values()]);
  }
  return out;
}
