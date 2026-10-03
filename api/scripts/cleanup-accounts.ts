/**
 * Kapalı beta / kabul testi hesaplarını siler: uygulamadaki "hesabımı sil" ile aynı yol (anonimleştirme, ilanlar
 * yayından kalkar, dosyalar silinir, oturumlar kapanır). Varsayılan yalnızca listeler; `--apply` ile uygular.
 *
 *   node --env-file=.env --import tsx scripts/cleanup-accounts.ts +905321112233 +905321112234          # önizleme
 *   node --env-file=.env --import tsx scripts/cleanup-accounts.ts +905321112233 +905321112234 --apply  # uygula
 *
 * Yönetici ve moderatör hesapları atlanır. Önce yedek al.
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { storageProvider } from '../src/adapters/storage';
import { purgeUserFiles } from '../src/modules/media/media.service';
import { deleteAccount } from '../src/modules/users/account-deletion';

const prisma = new PrismaClient();

export function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const phones = argv.filter((a) => a !== '--apply');
  const bad = phones.filter((p) => !/^\+905\d{9}$/.test(p));
  return { apply, phones, bad };
}

async function main() {
  const { apply, phones, bad } = parseArgs(process.argv.slice(2));
  if (!phones.length || bad.length) {
    console.error(bad.length ? `Geçersiz numara: ${bad.join(', ')} (biçim +905XXXXXXXXX)` : 'Kullanım: cleanup-accounts.ts +905XXXXXXXXX [...] [--apply]');
    process.exitCode = 1;
    return;
  }
  const users = await prisma.user.findMany({
    where: { phone: { in: phones }, deletedAt: null },
    select: { id: true, phone: true, name: true, roles: true, createdAt: true, _count: { select: { listings: true } } },
  });
  const staff = users.filter((u) => u.roles.some((r) => r !== 'user'));
  const targets = users.filter((u) => !staff.includes(u));
  for (const u of targets) console.log(`${apply ? 'SİLİNİYOR' : 'silinecek'}  ${u.phone}  ${u.name ?? '—'}  ${u.createdAt.toISOString().slice(0, 10)}  ${u._count.listings} ilan`);
  for (const u of staff) console.log(`atlandı (ekip)  ${u.phone}`);
  const missing = phones.filter((p) => !users.some((u) => u.phone === p));
  if (missing.length) console.log(`bulunamadı: ${missing.join(', ')}`);
  if (!apply) { console.log(`\nÖnizleme. Uygulamak için sona --apply ekle (${targets.length} hesap).`); return; }
  const storage = storageProvider.useFactory();
  for (const u of targets) {
    await deleteAccount(prisma, u.id, { remember: false, purgeFiles: (id) => purgeUserFiles(prisma, storage, id) });
    await prisma.auditLog.create({ data: { actorId: null, action: 'audit.accountDeleted', params: { via: 'cleanup-script' }, targetType: 'user', targetId: u.id } });
  }
  console.log(`\n${targets.length} hesap silindi.`);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
