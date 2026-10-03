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
type PaymentInfo = { status: string; autoReleaseAt?: Date | null; disputedAt?: Date | null } | null | undefined;

export function jobView(j: Job & { quotes: (Quote & { provider: ProviderProfile })[] }, viewer: { userId: string; providerId?: string }, payment?: PaymentInfo, reviewed?: boolean) {
  const owner = viewer.userId === j.ownerId;
  const quotes = owner ? j.quotes : j.quotes.filter((q) => q.providerId === viewer.providerId);
  return {
    id: j.id, category: j.category, title: j.title, description: j.description, region: j.region, boatId: owner ? j.boatId : undefined,
    status: j.status, acceptedQuoteId: j.acceptedQuoteId, createdAt: j.createdAt, completedAt: j.completedAt, isMine: owner,
    quotes: quotes.map(quoteView), paymentStatus: owner ? payment?.status ?? null : undefined, reviewed: owner ? !!reviewed : undefined,
    /** Usta işi bitirdi dedi; sahibi `autoReleaseAt`'e kadar onaylamaz ya da sorun bildirmezse ödeme aktarılır. */
    deliveredAt: j.deliveredAt, autoReleaseAt: owner ? payment?.autoReleaseAt ?? null : undefined, disputed: owner ? !!payment?.disputedAt : undefined,
  };
}

export function bookingView(b: CaptainBooking & { provider: ProviderProfile }, viewerId: string, reviewed?: boolean, payment?: PaymentInfo) {
  return {
    id: b.id, start: dateOnly(b.start), days: b.days, totalEur: b.totalEur, status: b.status, createdAt: b.createdAt,
    captain: providerView(b.provider), isMine: b.userId === viewerId, reviewed: b.userId === viewerId ? !!reviewed : undefined,
    autoReleaseAt: b.userId === viewerId ? payment?.autoReleaseAt ?? null : undefined, disputed: b.userId === viewerId ? !!payment?.disputedAt : undefined,
  };
}

/** Kaptan ücreti: 7 gün ve üstü haftalık (başlayan her hafta), altı günlük. Haftalık ücret yoksa 6 günlük ücret. */
export function captainTotal(p: Pick<ProviderProfile, 'dayRateEur' | 'weekRateEur'>, days: number): number {
  const day = p.dayRateEur ?? 0;
  const week = p.weekRateEur ?? day * 6;
  return days >= 7 ? week * Math.ceil(days / 7) : day * days;
}
