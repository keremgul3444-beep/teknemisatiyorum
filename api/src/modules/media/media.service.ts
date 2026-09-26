import crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { Visibility } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { safeEqual, sign } from '../../common/crypto';
import { STORAGE, type Storage } from '../../adapters/storage';
import { env } from '../../config/env';

const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
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

  async readPublic(id: string) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'public') throw Errors.notFound();
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

  private async read(key: string, mime: string) {
    const data = await this.storage.get(key);
    if (!data) throw Errors.notFound();
    return { data, mime };
  }
}
