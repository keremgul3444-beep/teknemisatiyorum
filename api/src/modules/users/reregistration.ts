import type { Prisma, PrismaClient } from '@prisma/client';
import { blindIndex } from '../../common/crypto';

type Db = PrismaClient | Prisma.TransactionClient;

/** Silinen sorunlu hesabın izleri bu kadar gün tutulur; sonra silinir (KVKK: amaçla sınırlı saklama). */
export const RETENTION_DAYS = 365;

export const phoneIndex = (phone: string) => blindIndex(`phone:${phone}`);

/**
 * Hesap silinmeden önce çağrılır: kural ihlali geçmişi varsa (bildirimi kabul edilmiş ya da açık bildirimli ilan,
 * ya da moderasyonla kaldırılmış ilan) telefon ve kimlik izleri saklanır. Temiz hesaplar için hiçbir şey tutulmaz.
 */
export async function rememberIfRisky(db: Db, user: { id: string; phone: string | null; nationalIdHash: string | null }) {
  const [reports, removed] = await Promise.all([
    db.listingReport.count({ where: { listing: { ownerId: user.id }, status: { in: ['open', 'actioned'] } } }),
    db.listing.count({ where: { ownerId: user.id, status: 'removed', publishedAt: { not: null } } }),
  ]);
  if (!reports && !removed) return false;
  const reason = reports ? 'reports' : 'takedown';
  const hashes = [user.phone ? phoneIndex(user.phone) : null, user.nationalIdHash].filter((h): h is string => !!h);
  if (!hashes.length) return false;
  await db.deletedIdentity.createMany({ data: hashes.map((hash) => ({ hash, deletedUserId: user.id, reason })) });
  return true;
}

/** Yeni giriş ya da kimlik doğrulamasında: iz eşleşirse kullanıcı işaretlenir; eşleşen silinmiş hesap kimliği döner. */
export async function flagIfReregistered(db: Db, userId: string, hash: string): Promise<string | null> {
  const hit = await db.deletedIdentity.findFirst({ where: { hash, deletedUserId: { not: userId } }, orderBy: { createdAt: 'desc' } });
  if (!hit) return null;
  await db.user.updateMany({ where: { id: userId, reregisteredFrom: null }, data: { reregisteredFrom: hit.deletedUserId } });
  return hit.deletedUserId;
}

export async function purgeDeletedIdentities(db: Db, now = new Date()) {
  const r = await db.deletedIdentity.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 864e5) } } });
  return r.count;
}
