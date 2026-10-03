import type { CaptainBooking, Job, ProviderProfile, Quote, Review } from '@prisma/client';
import { dateOnly } from '../boats/logbook.service';

/** Herkese açık hizmet veren kartı: telefon ve kişisel kimlik yok; puan ortalaması bir ondalık. */
export function providerView(p: ProviderProfile, reviews?: Review[]) {
  return {
    id: p.id, kind: p.kind, name: p.displayName, categories: p.categories, region: p.region, bio: p.bio, priceNote: p.priceNote,
    yearsExp: p.yearsExp, languages: p.languages, areas: p.areas, dayRateEur: p.dayRateEur, weekRateEur: p.weekRateEur,
    rating: p.ratingCount ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : null, reviewCount: p.ratingCount,
    verified: p.status === 'active',
    ...(reviews ? { reviews: reviews.map((r) => ({ id: r.id, stars: r.stars, text: r.text, createdAt: r.createdAt })) } : {}),
  };
}

export function quoteView(q: Quote & { provider: ProviderProfile }) {
  return { id: q.id, priceTry: q.priceTry, days: q.days, note: q.note, createdAt: q.createdAt, provider: providerView(q.provider) };
}

/** İş görünümü. `viewer`: sahibi tüm teklifleri, teklif veren usta yalnızca kendi teklifini görür. */
export function jobView(j: Job & { quotes: (Quote & { provider: ProviderProfile })[] }, viewer: { userId: string; providerId?: string }, payment?: { status: string } | null) {
  const owner = viewer.userId === j.ownerId;
  const quotes = owner ? j.quotes : j.quotes.filter((q) => q.providerId === viewer.providerId);
  return {
    id: j.id, category: j.category, title: j.title, description: j.description, region: j.region, boatId: owner ? j.boatId : undefined,
    status: j.status, acceptedQuoteId: j.acceptedQuoteId, createdAt: j.createdAt, completedAt: j.completedAt, isMine: owner,
    quotes: quotes.map(quoteView), paymentStatus: owner ? payment?.status ?? null : undefined,
  };
}

export function bookingView(b: CaptainBooking & { provider: ProviderProfile }, viewerId: string) {
  return {
    id: b.id, start: dateOnly(b.start), days: b.days, totalEur: b.totalEur, status: b.status, createdAt: b.createdAt,
    captain: providerView(b.provider), isMine: b.userId === viewerId,
  };
}

/** Kaptan ücreti: 7 gün ve üstü haftalık (başlayan her hafta), altı günlük. Haftalık ücret yoksa 6 günlük ücret. */
export function captainTotal(p: Pick<ProviderProfile, 'dayRateEur' | 'weekRateEur'>, days: number): number {
  const day = p.dayRateEur ?? 0;
  const week = p.weekRateEur ?? day * 6;
  return days >= 7 ? week * Math.ceil(days / 7) : day * days;
}
