import type { PrismaClient } from '@prisma/client';
import { retireServices } from '../marketplace/lifecycle';
import { rememberIfRisky } from './reregistration';

/**
 * Hesap silme (uygulamadaki "hesabımı sil" ve yönetim betiği aynı yolu kullanır): kişisel alanlar temizlenir ve
 * kullanıcı anonimleşir; ilanları yayından kalkar, karne geçmişi "silinmiş kullanıcı" olarak kalır; oturumlar kapanır,
 * usta/kaptan tarafı kapanır, firma üyelikleri biter, dosyalar silinir.
 * `remember`: kural ihlali geçmişi varsa telefon ve kimlik izi saklanır (deneme hesabı temizliğinde kapalı).
 * `purgeFiles`: dosya silme (uygulamada MediaService, betikte doğrudan depo).
 */
export async function deleteAccount(prisma: PrismaClient, userId: string, o: { remember: boolean; purgeFiles: (userId: string) => Promise<void> }) {
  const now = new Date();
  const { phone, nationalIdHash } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, nationalIdHash: true } });
  // İlanlar kaldırılmadan önce: kaldırılmış ilan sayısı ihlal geçmişine sayılır.
  if (o.remember) await rememberIfRisky(prisma, { id: userId, phone, nationalIdHash });
  await prisma.$transaction([
    // Giriş kodu kayıtları da telefon numarası taşır; hesapla birlikte gider.
    ...(phone ? [prisma.otpCode.deleteMany({ where: { phone } })] : []),
    prisma.user.update({
      where: { id: userId },
      data: { phone: null, name: null, email: null, nationalIdEnc: null, nationalIdLast2: null, nationalIdHash: null, deletedAt: now },
    }),
    // KVKK: silinen kişinin ilanları yayından kalkar (kayıt geçmiş için saklanır, kimseye gösterilmez).
    prisma.listing.updateMany({ where: { ownerId: userId, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  await retireServices(prisma, userId, { anonymize: true });
  // Firma üyelikleri biter (sahibi olduğu firma diğer üyeler için kalır); teklif talepleri (ad, telefon) silinir.
  await prisma.companyMember.deleteMany({ where: { userId } });
  await prisma.leadRequest.deleteMany({ where: { userId } });
  await o.purgeFiles(userId);
}
