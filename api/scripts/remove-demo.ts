/**
 * Canlıya çıkmadan önce demo içeriği kaldırır: demo satıcıların (seed.ts SELLERS) ilanları yayından kalkar,
 * fotoğrafları depodan silinir, hesapları silinmiş hesap gibi anonimleşir, demo firmaları silinir.
 * `node --env-file=.env --import tsx scripts/remove-demo.ts` — önce yedek al. Yeniden çalıştırmak güvenlidir.
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { storageProvider } from '../src/adapters/storage';
import { MEDIA_WIDTHS } from '../src/modules/media/media.service';
import { SELLERS } from '../prisma/seed';

const prisma = new PrismaClient();

(async () => {
  const phones = Object.values(SELLERS).map((s) => s.phone);
  const users = await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (!ids.length) { console.log('Demo hesabı yok; yapılacak bir şey yok.'); return; }
  const storage = storageProvider.useFactory();
  const files = await prisma.file.findMany({ where: { ownerId: { in: ids } } });
  for (const f of files) for (const k of [f.key, ...MEDIA_WIDTHS.map((w) => `${f.key}.w${w}.webp`)]) await storage.remove(k);
  const now = new Date();
  const [listings] = await prisma.$transaction([
    prisma.listing.updateMany({ where: { ownerId: { in: ids }, status: { not: 'removed' } }, data: { status: 'removed' } }),
    prisma.listingPhoto.deleteMany({ where: { fileId: { in: files.map((f) => f.id) } } }),
    prisma.file.deleteMany({ where: { id: { in: files.map((f) => f.id) } } }),
    prisma.company.deleteMany({ where: { members: { some: { userId: { in: ids } } } } }),
    prisma.user.updateMany({ where: { id: { in: ids } }, data: { phone: null, name: null, email: null, deletedAt: now } }),
    prisma.session.updateMany({ where: { userId: { in: ids }, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  console.log(`Demo içerik kaldırıldı: ${ids.length} hesap, ${listings.count} ilan, ${files.length} dosya.`);
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
