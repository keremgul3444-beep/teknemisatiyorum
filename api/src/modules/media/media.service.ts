import crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { Prisma, type Visibility } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { safeEqual, sign } from '../../common/crypto';
import { STORAGE, type Storage } from '../../adapters/storage';
import { env } from '../../config/env';

const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Site ve uygulamanın isteyebileceği görsel genişlikleri (başkası reddedilir: disk dolmasın). */
export const MEDIA_WIDTHS = [400, 800, 1600] as const;
const SIGNED_TTL_S = 5 * 60;
const unsupported = () => new AppError('UNSUPPORTED_TYPE', 'errors.unsupportedType', 415);

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE) private readonly storage: Storage) {}

  /**
   * Türü dosya adına ya da istemcinin söylediğine göre değil içeriğe göre belirler.
   * Resimler yeniden kodlanır: yön düzeltilir, uzun kenar 2000 px'e indirilir, EXIF (konum dahil) atılır.
   * PDF yalnızca korumalı belgeler için kabul edilir.
   */
  async upload(ownerId: string, buf: Buffer, visibility: Visibility) {
    let out: Buffer;
    let mime: string;
    if (visibility === 'private' && buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      out = buf;
      mime = 'application/pdf';
    } else {
      const meta = await sharp(buf).metadata().catch(() => null);
      if (!meta?.format || !IMAGE_FORMATS.has(meta.format)) throw unsupported();
      out = await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      mime = 'image/jpeg';
    }
    const id = crypto.randomUUID();
    const key = `${visibility}/${id.slice(0, 2)}/${id}`;
    await this.storage.put(key, out);
    await this.prisma.file.create({ data: { id, ownerId, visibility, key, mime, size: out.length } });
    return { id, url: visibility === 'public' ? `${env().PUBLIC_URL}/media/${id}` : undefined };
  }

  /** Herkese açık görselin küçültülmüş WebP'si; ilk istekte üretilir, diskte saklanır. */
  async readPublicWidth(id: string, w: number) {
    if (!(MEDIA_WIDTHS as readonly number[]).includes(w)) throw Errors.bad('BAD_WIDTH', { allowed: MEDIA_WIDTHS.join(',') });
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'public') throw Errors.notFound();
    const gone = await this.prisma.user.count({ where: { id: f.ownerId, deletedAt: { not: null } } });
    if (gone) throw Errors.notFound();
    const key = `${f.key}.w${w}.webp`;
    const cached = await this.storage.get(key);
    if (cached) return { mime: 'image/webp', data: cached };
    const original = await this.storage.get(f.key);
    if (!original) throw Errors.notFound();
    const data = await sharp(original).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await this.storage.put(key, data);
    return { mime: 'image/webp', data };
  }

  async readPublic(id: string) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'public') throw Errors.notFound();
    // Hesabını silen kişinin fotoğrafları bağlantısı bilinse bile açılmaz.
    const gone = await this.prisma.user.count({ where: { id: f.ownerId, deletedAt: { not: null } } });
    if (gone) throw Errors.notFound();
    return this.read(f.key, f.mime);
  }

  /** Korumalı dosya için 5 dakikalık imzalı bağlantı; yalnızca sahibi ya da moderatör. */
  async signedUrl(id: string, userId: string, isModerator: boolean) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'private' || (f.ownerId !== userId && !isModerator)) throw Errors.notFound();
    const exp = Math.floor(Date.now() / 1000) + SIGNED_TTL_S;
    return { url: `${env().PUBLIC_URL}/media/${id}/raw?exp=${exp}&sig=${sign(`${id}.${exp}`)}`, expiresAt: new Date(exp * 1000) };
  }

  async readSigned(id: string, exp: string, sig: string) {
    const e = Number(exp);
    if (!Number.isFinite(e) || e < Date.now() / 1000 || !safeEqual(sign(`${id}.${e}`), sig ?? '')) throw Errors.notFound();
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f) throw Errors.notFound();
    return this.read(f.key, f.mime);
  }

  /** Verilen dosyaların hepsi bu kullanıcının korumalı dosyası mı? */
  async assertOwnPrivate(userId: string, ids: string[]) {
    const n = await this.prisma.file.count({ where: { id: { in: ids }, ownerId: userId, visibility: 'private' } });
    if (n !== new Set(ids).size) throw Errors.notFound();
  }

  async assertOwnPublic(userId: string, ids: string[]) {
    const n = await this.prisma.file.count({ where: { id: { in: ids }, ownerId: userId, visibility: 'public' } });
    if (n !== new Set(ids).size) throw Errors.notFound();
  }

  /**
   * Hesap silmede (KVKK): kullanıcının bütün dosyaları — korumalı belgeler (kimlik, ruhsat vb.) ve
   * herkese açık fotoğraflar küçük kopyalarıyla — diskten ve veritabanından kaldırılır.
   */
  async purgeUser(userId: string) {
    const files = await this.prisma.file.findMany({ where: { ownerId: userId } });
    const keys = files.flatMap((f) => [f.key, ...MEDIA_WIDTHS.map((w) => `${f.key}.w${w}.webp`)]);
    await Promise.all(keys.map((k) => this.storage.remove(k)));
    const ids = files.map((f) => f.id);
    await this.prisma.listingPhoto.deleteMany({ where: { fileId: { in: ids } } });
    await this.prisma.file.deleteMany({ where: { id: { in: ids } } });
    await this.prisma.verificationRequest.updateMany({ where: { userId }, data: { fileIds: [], details: Prisma.DbNull } });
    // Bekleyen başvurular geri çekilir: silinmiş hesap moderatör kuyruğunda görünmez, onaylanamaz.
    await this.prisma.verificationRequest.updateMany({ where: { userId, status: 'pending' }, data: { status: 'rejected', rejectReason: 'withdrawn', decidedAt: new Date() } });
  }

  private async read(key: string, mime: string) {
    const data = await this.storage.get(key);
    if (!data) throw Errors.notFound();
    return { data, mime };
  }
}
