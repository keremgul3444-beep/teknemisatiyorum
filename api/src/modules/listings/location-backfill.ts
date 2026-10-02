import type { PrismaClient } from '@prisma/client';
import { normalizeLocation } from '@tms/shared';

/**
 * Konum kuralından önce yazılmış ilanların konumunu tek biçime getirir ("bodrum" → "Bodrum").
 * Tekrar çalıştırılabilir; düzeltilen ilan sayısını döner.
 */
export async function normalizeListingLocations(prisma: Pick<PrismaClient, 'listing'>) {
  const groups = await prisma.listing.groupBy({ by: ['location'] });
  let fixed = 0;
  for (const { location } of groups) {
    const norm = normalizeLocation(location);
    if (norm === location) continue;
    fixed += (await prisma.listing.updateMany({ where: { location }, data: { location: norm } })).count;
  }
  return fixed;
}
