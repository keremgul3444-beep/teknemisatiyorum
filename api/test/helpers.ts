import crypto from 'crypto';
import sharp from 'sharp';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import type { TestApp } from './setup';

let n = 0;
/** Doğrudan veritabanında kullanıcı + oturum oluşturup giriş anahtarı döndürür (giriş akışı auth testlerinde ayrıca sınanır). */
export async function loginAs(t: TestApp, opts: { level?: number; roles?: Role[]; name?: string } = {}) {
  const phone = `+90555${String((++n * 7919 + crypto.randomInt(0, 1000) * 10007) % 1e7).padStart(7, '0')}`;
  const user = await t.prisma.user.create({
    data: { phone, verifyLevel: opts.level ?? 1, roles: opts.roles ?? ['user'], name: opts.name ?? `Test ${n}` },
  });
  const s = await t.prisma.session.create({
    data: { userId: user.id, familyId: crypto.randomUUID(), deviceName: 'test', refreshHash: crypto.randomBytes(16).toString('hex') },
  });
  const token = await t.app.get(JwtService).signAsync({ sub: user.id, sid: s.id });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

/** EXIF (GPS dahil) içeren test fotoğrafı üretir. */
export async function jpegWithExif(width = 3000, height = 1000) {
  return sharp({ create: { width, height, channels: 3, background: { r: 15, g: 110, b: 104 } } })
    .withExif({ IFD0: { Make: 'TestKamera', Model: 'GPS-li' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '37/1 2/1 0/1' } })
    .jpeg()
    .toBuffer();
}

/** Bir yanıt gövdesinde verilen metnin (derinlemesine) geçip geçmediği. */
export const deepContains = (body: unknown, needle: string) => JSON.stringify(body).includes(needle);

/** Algoritmik olarak geçerli, rastgele T.C. kimlik numarası (her test kendi numarasını kullansın; numara tekildir). */
export function randomTckn() {
  const d = [crypto.randomInt(1, 10), ...Array.from({ length: 8 }, () => crypto.randomInt(0, 10))];
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}

/** Yayındaki ilanın bekleyen düzenlemesini bir moderatörle onaylar (ilan sütunları ancak onayda değişir). */
export async function approveEdit(t: TestApp, listingId: string) {
  const mod = await loginAs(t, { level: 3, roles: ['moderator'] });
  const l = await t.prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
  const r = await t.http().post(`/admin/listings/${listingId}/decision`).set(mod.auth).send({ decision: 'approve', version: l.updatedAt.toISOString() });
  if (r.status !== 200) throw new Error(`approveEdit ${r.status} ${JSON.stringify(r.body)}`);
}
