import type { Listing } from '@prisma/client';

/** Onay kuyruğunda karşılaştırılan alanlar: yayına çıkan içerik. */
export const SNAPSHOT_FIELDS = [
  'brand', 'model', 'year', 'lengthM', 'type', 'price', 'currency', 'location', 'equipment', 'cabins', 'engine',
  'description', 'engineHours', 'flag', 'tradeIn', 'negotiable', 'videoUrl',
] as const;
export type Snapshot = Record<(typeof SNAPSHOT_FIELDS)[number] | 'photos', unknown>;

/** Onay anındaki hâl (fotoğraflar sırasıyla). */
export function listingSnapshot(l: Listing, photoIds: string[]): Snapshot {
  const s = Object.fromEntries(SNAPSHOT_FIELDS.map((k) => [k, l[k] ?? null])) as Snapshot;
  s.photos = photoIds;
  return s;
}

/** Son onaydan bu yana değişen alanlar; hiç onaylanmamışsa null (ilk inceleme). */
export function changedFields(snapshot: unknown, now: Snapshot): string[] | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const before = snapshot as Snapshot;
  return (Object.keys(now) as (keyof Snapshot)[]).filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(now[k] ?? null));
}
