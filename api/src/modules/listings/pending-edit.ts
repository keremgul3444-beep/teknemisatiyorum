import { Prisma, type Listing, type ListingPhoto } from '@prisma/client';

/**
 * Yayındaki ilanın onay bekleyen düzenlemesi. İlan sütunları onaylı hâli tutar (arama ve herkese açık sayfa
 * bunu görür); değişiklik `pendingChanges` / `pendingPhotoIds` alanında bekler. Sahibi ve moderatör birleşik hâli görür.
 */
export type PendingChanges = Partial<Pick<Listing,
  'brand' | 'model' | 'year' | 'lengthM' | 'type' | 'price' | 'currency' | 'location' | 'equipment' | 'cabins' | 'engine' | 'description'
  | 'engineHours' | 'flag' | 'tradeIn' | 'negotiable' | 'videoUrl' | 'companyId' | 'boatId'>>;

/** Bu alanlardan biri değişirse ilan başka bir tekneyi anlatıyor olabilir. */
export const IDENTITY_FIELDS = ['brand', 'model', 'year', 'lengthM', 'boatId'] as const;
/** Tekneye bağlı (belge/ekspertizle kazanılan) rozetler; satıcının kendi beyanına dayananlar değil. */
export const BOAT_BOUND_BADGES = ['sahiplik', 'belge', 'ekspertizli'];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Yeni değişiklikler öncekilerin üstüne yazılır; onaylı değerle aynı olanlar düşer. Boşsa null. */
export function mergePending(l: Listing, changes: Record<string, unknown>): PendingChanges | null {
  const merged: Record<string, unknown> = { ...((l.pendingChanges as Record<string, unknown> | null) ?? {}), ...changes };
  for (const k of Object.keys(merged)) if (same(merged[k], (l as Record<string, unknown>)[k])) delete merged[k];
  return Object.keys(merged).length ? (merged as PendingChanges) : null;
}

/** Bekleyen fotoğraf listesi: onaylı listeyle aynıysa değişiklik yok (boş dizi). */
export function pendingPhotos(current: string[], next: string[]): string[] {
  return same(current, next) ? [] : next;
}

/** Bekleyen düzenleme varsa sahibinin/moderatörün göreceği birleşik hâl. */
export function effective<T extends Listing & { photos: ListingPhoto[] }>(l: T): T {
  if (!l.pendingAt) return l;
  const photos = l.pendingPhotoIds.length
    ? l.pendingPhotoIds.map((fileId, order) => ({ id: `pending-${order}`, listingId: l.id, fileId, order }))
    : l.photos;
  return { ...l, ...((l.pendingChanges as PendingChanges | null) ?? {}), photos };
}

/** Kuyrukta gösterilecek değişen alanlar (bekleyen düzenleme için). */
export function pendingFields(l: Listing): string[] {
  return [...Object.keys((l.pendingChanges as Record<string, unknown> | null) ?? {}), ...(l.pendingPhotoIds.length ? ['photos'] : [])];
}

/** Bekleyen düzenlemeyi temizleyen alanlar. */
export const CLEAR_PENDING = { pendingChanges: Prisma.DbNull, pendingPhotoIds: [] as string[], pendingAt: null };
