import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Hesap askıya alınınca ya da silinince hizmet tarafı da kapanır:
 * - usta/kaptan profilleri listeden kalkar (`suspended`); silmede görünen bilgiler de temizlenir (KVKK),
 * - kişinin açık iş talepleri ve ödenmemiş kaptan talepleri iptal olur,
 * - usta olarak verdiği teklifler ödenmemiş işlerden çekilir; kabul edilmiş ama ödenmemiş iş yeniden teklif almaya açılır,
 * - ödenmiş (emanetteki) işler ve rezervasyonlar ekibin ödeme ekranında iade/aktarma kararına kalır.
 * Döner: kaç profil ve kaç iş etkilendi.
 */
export async function retireServices(db: Db, userId: string, o: { anonymize: boolean }) {
  const profiles = await db.providerProfile.findMany({ where: { userId }, select: { id: true } });
  const ids = profiles.map((p) => p.id);
  await db.providerProfile.updateMany({
    where: { userId },
    data: { status: 'suspended', ...(o.anonymize ? { displayName: '—', bio: '', priceNote: '', areas: [], languages: [] } : {}) },
  });
  const ownJobs = await db.job.updateMany({ where: { ownerId: userId, status: { in: ['open', 'accepted'] } }, data: { status: 'cancelled' } });
  await db.captainBooking.updateMany({ where: { OR: [{ userId }, { providerId: { in: ids } }], status: { in: ['requested', 'accepted'] } }, data: { status: 'cancelled' } });
  if (ids.length) {
    // Bu ustanın teklifi kabul edilmiş ama ödenmemiş işler yeniden teklif almaya açılır.
    const quotes = await db.quote.findMany({ where: { providerId: { in: ids } }, select: { id: true } });
    await db.job.updateMany({ where: { status: 'accepted', acceptedQuoteId: { in: quotes.map((q) => q.id) } }, data: { status: 'open', acceptedQuoteId: null } });
    await db.quote.deleteMany({ where: { providerId: { in: ids }, job: { status: 'open' } } });
  }
  return { profiles: ids.length, jobs: ownJobs.count };
}

/** Askı kalkınca: belgesi onaylı profiller yeniden yayına, onaysızlar onay beklemeye döner. */
export async function restoreServices(db: Db, userId: string) {
  const approved = await db.verificationRequest.findMany({ where: { userId, kind: { in: ['usta', 'kaptan'] }, status: 'approved' }, select: { kind: true } });
  const kinds = [...new Set(approved.map((v) => v.kind))] as ('usta' | 'kaptan')[];
  await db.providerProfile.updateMany({ where: { userId, status: 'suspended', kind: { in: kinds } }, data: { status: 'active' } });
  await db.providerProfile.updateMany({ where: { userId, status: 'suspended', kind: { notIn: kinds } }, data: { status: 'pending' } });
}
