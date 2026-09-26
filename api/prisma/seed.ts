// Başlangıç verisi: prototipteki 25 ilan (degrade fotoğraflarla), ekspertiz paketleri, kurlar ve yönetici hesabı.
// Kullanım: node --env-file=.env --import tsx prisma/seed.ts   (scripts/dev.mjs veritabanı boşsa kendisi çalıştırır)
import 'reflect-metadata';
import crypto from 'crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { makeListings } from '@tms/shared';
import { LocalDiskStorage } from '../src/adapters/storage';

const GRADIENTS: [string, string][] = [
  ['#5FA8A0', '#0F6E68'], ['#7FB7C9', '#1F5E7A'], ['#9DB8A0', '#3E6B4F'],
  ['#C9B48A', '#7A5A2E'], ['#8FA9C4', '#2F4C6E'], ['#6FB3A8', '#1D4D4A'],
];

/** Prototipteki degrade + tekne silüeti görselini gerçek bir jpeg olarak üretir. */
async function boatPhoto(seed: number) {
  const [a, b] = GRADIENTS[seed % GRADIENTS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <g transform="translate(360,540) scale(2.8)">
      <path d="M5 30 L165 30 L148 46 L22 46 Z" fill="#fff" opacity=".92"/>
      <path d="M45 30 L60 14 L120 14 L132 30 Z" fill="#fff" opacity=".75"/>
    </g></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
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
    const photo = await boatPhoto(l.photoSeed);
    const fileId = crypto.randomUUID();
    const key = `public/${fileId.slice(0, 2)}/${fileId}`;
    await storage.put(key, photo);
    await prisma.file.create({ data: { id: fileId, ownerId: userIds[l.sellerId], visibility: 'public', key, mime: 'image/jpeg', size: photo.length } });
    await prisma.listing.create({
      data: {
        ownerId: userIds[l.sellerId], companyId: companyIds[l.sellerId] ?? null,
        brand: l.brand, model: l.model, year: l.year, lengthM: l.lengthM, type: l.type, price: l.price, currency: l.currency,
        location: l.location, equipment: l.equipment, badges: l.badges, cabins: l.cabins, engine: l.engine, description: l.description,
        status: 'published', publishedAt: new Date(Date.now() - (listings.length - i) * 3600_000),
        photos: { create: { fileId, order: 0 } },
      },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  prisma.listing.count()
    .then((n) => (n ? console.log('Veritabanında ilan var; başlangıç verisi atlandı.') : runSeed(prisma).then(() => console.log('Başlangıç verisi yüklendi.'))))
    .finally(() => prisma.$disconnect());
}
