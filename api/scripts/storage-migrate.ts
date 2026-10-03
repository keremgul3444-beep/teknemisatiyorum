/**
 * Yerel diskteki dosyaları S3 uyumlu buluta kopyalar (STORAGE_DRIVER=local → s3 geçişi).
 * `node --env-file=.env --import tsx scripts/storage-migrate.ts` — .env'de S3_* dolu olmalı; STORAGE_DRIVER henüz local kalabilir.
 * Yalnızca veritabanındaki dosyalar taşınır (küçük kopyalar ilk istekte yeniden üretilir). Yeniden çalıştırmak güvenlidir.
 */
import { PrismaClient } from '@prisma/client';
import { LocalDiskStorage } from '../src/adapters/storage';
import { S3Client } from '../src/adapters/s3';

const e = process.env;
for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
  if (!e[k]) { console.error(`${k} eksik (api/.env)`); process.exit(1); }
}
const s3 = new S3Client({ endpoint: e.S3_ENDPOINT!, region: e.S3_REGION || 'auto', bucket: e.S3_BUCKET!, accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! });
const local = new LocalDiskStorage();
const prisma = new PrismaClient();

(async () => {
  const files = await prisma.file.findMany({ select: { key: true } });
  let copied = 0;
  let missing = 0;
  for (const f of files) {
    const data = await local.get(f.key);
    if (!data) { missing++; continue; }
    await s3.put(f.key, data);
    copied++;
    if (copied % 100 === 0) console.log(`${copied}/${files.length}`);
  }
  console.log(`Bitti: ${copied} dosya kopyalandı, ${missing} dosya diskte yoktu. Şimdi .env'de STORAGE_DRIVER=s3 yapıp sunucuyu yeniden başlat.`);
  await prisma.$disconnect();
})().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
