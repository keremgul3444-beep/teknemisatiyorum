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
