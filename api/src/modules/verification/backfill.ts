import type { PrismaClient } from '@prisma/client';
import { blindIndex, decrypt } from '../../common/crypto';

/**
 * Kimlik tekliği kuralından (0003) önce doğrulanmış kullanıcıların kimlik izini doldurur. Tekrar
 * çalıştırılabilir; aynı numara iki hesapta çıkarsa ya da kayıt çözülemezse o satır atlanır, raporlanır
 * (yarıda durmaz, sunucunun açılmasını engellemez).
 */
export async function backfillNationalIdHashes(prisma: Pick<PrismaClient, 'user'>) {
  const rows = await prisma.user.findMany({
    where: { nationalIdEnc: { not: null }, nationalIdHash: null, deletedAt: null },
    select: { id: true, nationalIdEnc: true }, orderBy: { createdAt: 'asc' },
  });
  let filled = 0;
  const conflicts: { userId: string; heldBy: string }[] = [];
  const unreadable: string[] = [];
  for (const r of rows) {
    let hash: string;
    try {
      hash = blindIndex(decrypt(r.nationalIdEnc!));
    } catch {
      unreadable.push(r.id); // başka anahtarla şifrelenmiş ya da bozuk kayıt: atlanır, raporlanır
      continue;
    }
    const holder = await prisma.user.findUnique({ where: { nationalIdHash: hash }, select: { id: true } });
    if (holder) { conflicts.push({ userId: r.id, heldBy: holder.id }); continue; }
    await prisma.user.update({ where: { id: r.id }, data: { nationalIdHash: hash } });
    filled++;
  }
  return { filled, conflicts, unreadable };
}
