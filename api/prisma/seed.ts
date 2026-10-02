// Başlangıç verisi: prototipteki 25 ilan (MINOA'nın gerçek tekne fotoğraflarıyla), ekspertiz paketleri, kurlar ve yönetici hesabı.
// Kullanım: node --env-file=.env --import tsx prisma/seed.ts   (scripts/dev.mjs veritabanı boşsa kendisi çalıştırır)
import 'reflect-metadata';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { makeListings } from '@tms/shared';
import { LocalDiskStorage } from '../src/adapters/storage';

/** Demo fotoğrafları: `shared/assets/boats` (uygulamanın demo modu da aynı dosyaları gösterir). İlk 8'i dış çekim. */
const PHOTO_DIR = path.resolve(__dirname, '../../shared/assets/boats');
const PHOTOS = fs.readdirSync(PHOTO_DIR).filter((f) => f.endsWith('.jpg')).sort();
const EXTERIOR = 8;
/** İlanın galerisi: kapak dış çekim, sonraki 3 kare iç mekân/güverte (uygulamadaki `boatPhoto` ile aynı sıra). */
function boatPhotos(seed: number) {
  const cover = PHOTOS[seed % EXTERIOR];
  const inner = PHOTOS.slice(EXTERIOR);
  const frames = [1, 2, 3].map((k) => inner[(seed + k - 1) % inner.length]);
  return [cover, ...frames].map((f) => fs.readFileSync(path.join(PHOTO_DIR, f)));
}

const SELLERS: Record<string, { phone: string; name: string }> = {
  u1: { phone: '+905550000101', name: 'Ahmet K.' }, u2: { phone: '+905550000102', name: 'Elif S.' },
  u3: { phone: '+905550000103', name: 'Mert A.' }, u4: { phone: '+905550000104', name: 'Canan T.' },
  u5: { phone: '+905550000105', name: 'Oğuz B.' }, u6: { phone: '+905550000106', name: 'Derya M.' },
  c1: { phone: '+905550000201', name: 'Selim Ak' }, c2: { phone: '+905550000202', name: 'Rıza Ay' },
};
const COMPANIES: Record<string, { name: string; kind: string; city: string }> = {
  c1: { name: 'Mavi Koy Yatçılık', kind: 'broker', city: 'Bodrum' },
  c2: { name: 'Ege Tekne Galerisi', kind: 'galeri', city: 'Çeşme' },
};

/** Öne çıkarma ürünleri: deneme fiyatı (1 TL). Her çalıştırmada (upsert); yöneticinin girdiği fiyat ezilmez. */
export async function seedProducts(prisma: PrismaClient) {
  const PRODUCTS = [
    { code: 'vitrin_7', kind: 'vitrin', days: 7 }, { code: 'vitrin_30', kind: 'vitrin', days: 30 },
    { code: 'acil_7', kind: 'acil', days: 7 }, { code: 'acil_30', kind: 'acil', days: 30 },
    { code: 'ust_tasi', kind: 'bump', days: null },
  ] as const;
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { code: p.code },
      create: { ...p, priceWebKurus: 100, priceAppKurus: 100, isTrialPrice: true, iosProductId: `tms.${p.code}`, androidProductId: `tms_${p.code}` },
      update: {},
    });
  }
}

export async function runSeed(prisma: PrismaClient) {
  await prisma.user.upsert({
    where: { phone: '+905000000000' },
    create: { phone: '+905000000000', name: 'Yönetici', verifyLevel: 3, roles: ['admin', 'moderator'] },
    update: {},
  });
  for (const [currency, rateToTry] of [['TRY', 1], ['EUR', 48], ['USD', 41]] as const) {
    await prisma.fxRate.upsert({ where: { currency }, create: { currency, rateToTry }, update: {} });
  }
  const packages = [
    { name: 'Temel', priceTry: 12500, order: 1, items: ['Gövde görsel kontrol', 'Motor çalıştırma testi', 'Belge kontrolü'] },
    { name: 'Kapsamlı', priceTry: 24000, order: 2, items: ['Temel paketin tamamı', 'Deniz testi', 'Elektrik sistemi', 'Motor yağ analizi'] },
    { name: 'Premium', priceTry: 42000, order: 3, items: ['Kapsamlı paketin tamamı', 'Çekekte sualtı gövde kontrolü', 'Termal kamera', 'Detaylı fotoğraflı rapor'] },
  ];
  // Ada göre eksik olanlar eklenir; tekrar çalıştırmak çoğaltmaz.
  for (const p of packages) {
    if (!(await prisma.expertisePackage.findFirst({ where: { name: p.name } }))) await prisma.expertisePackage.create({ data: p });
  }

  await seedProducts(prisma);

  const userIds: Record<string, string> = {};
  const companyIds: Record<string, string> = {};
  for (const [key, s] of Object.entries(SELLERS)) {
    const u = await prisma.user.upsert({ where: { phone: s.phone }, create: { ...s, verifyLevel: 2 }, update: {} });
    userIds[key] = u.id;
    const c = COMPANIES[key];
    if (c) {
      const existing = await prisma.company.findFirst({ where: { name: c.name } });
      companyIds[key] = existing?.id ?? (await prisma.company.create({ data: { ...c, members: { create: { userId: u.id, role: 'owner' } } } })).id;
    }
  }

  const storage = new LocalDiskStorage();
  const listings = makeListings();
  for (const [i, l] of listings.entries()) {
    const fileIds: string[] = [];
    for (const photo of boatPhotos(l.photoSeed)) {
      const fileId = crypto.randomUUID();
      const key = `public/${fileId.slice(0, 2)}/${fileId}`;
      await storage.put(key, photo);
      await prisma.file.create({ data: { id: fileId, ownerId: userIds[l.sellerId], visibility: 'public', key, mime: 'image/jpeg', size: photo.length } });
      fileIds.push(fileId);
    }
    await prisma.listing.create({
      data: {
        ownerId: userIds[l.sellerId], companyId: companyIds[l.sellerId] ?? null,
        brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, type: l.type, price: l.price, currency: l.currency,
        location: l.location, equipment: l.equipment, badges: l.badges, cabins: l.cabins, engine: l.engine, description: l.description,
        status: 'published', publishedAt: new Date(Date.now() - (listings.length - i) * 3600_000),
        photos: { create: fileIds.map((fileId, order) => ({ fileId, order })) },
      },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  // Ürün tablosu her seferinde tamamlanır (sonradan eklenen tablolar mevcut veritabanında da dolsun).
  seedProducts(prisma)
    .then(() => prisma.listing.count())
    .then((n) => (n ? console.log('Veritabanında ilan var; başlangıç verisi atlandı.') : runSeed(prisma).then(() => console.log('Başlangıç verisi yüklendi.'))))
    .finally(() => prisma.$disconnect());
}
