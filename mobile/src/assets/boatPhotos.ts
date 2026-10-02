/**
 * Demo ilan fotoğrafları: MINOA'nın gerçek tekne çekimleri (tek kaynak `shared/assets/boats`, Metro bu klasörü izler).
 * İlk 8'i dış çekim (kart kapağı), kalanı iç mekân ve güverte (ilan galerisi). Sunucu seed'i de aynı dosyaları kullanır.
 */
export const BOAT_PHOTOS = [
  require('../../../shared/assets/boats/01-aerial-cruise.jpg'),
  require('../../../shared/assets/boats/02-hero-broadside.jpg'),
  require('../../../shared/assets/boats/03-aerial-side.jpg'),
  require('../../../shared/assets/boats/04-gallery-cruise.jpg'),
  require('../../../shared/assets/boats/05-aerial-stern.jpg'),
  require('../../../shared/assets/boats/06-skyline.jpg'),
  require('../../../shared/assets/boats/07-night-aerial.jpg'),
  require('../../../shared/assets/boats/08-side-deck.jpg'),
  require('../../../shared/assets/boats/09-salon.jpg'),
  require('../../../shared/assets/boats/10-owner-cabin.jpg'),
  require('../../../shared/assets/boats/11-aft-deck-dusk.jpg'),
  require('../../../shared/assets/boats/12-foredeck-seats.jpg'),
  require('../../../shared/assets/boats/13-int-dinette.jpg'),
  require('../../../shared/assets/boats/14-night-foredeck.jpg'),
  require('../../../shared/assets/boats/15-salon-view.jpg'),
  require('../../../shared/assets/boats/16-int-helm.jpg'),
] as const;
export const EXTERIOR_COUNT = 8;

/** `seed` ilanın sırası; kapak dış çekimlerden, galerideki sonraki kareler (seed+1, +2…) iç mekânlardan gelir. */
export function boatPhoto(seed: number, frame = 0) {
  const s = Math.abs(seed);
  if (frame === 0) return BOAT_PHOTOS[s % EXTERIOR_COUNT];
  return BOAT_PHOTOS[EXTERIOR_COUNT + ((s + frame - 1) % (BOAT_PHOTOS.length - EXTERIOR_COUNT))];
}
