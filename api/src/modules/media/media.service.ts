import crypto from 'crypto';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import sharp from 'sharp';
import { Prisma, type Visibility } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { safeEqual, sign } from '../../common/crypto';
import { STORAGE, type Storage } from '../../adapters/storage';
import { env } from '../../config/env';
import { dhash } from './phash';

const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Site ve uygulamanın isteyebileceği görsel genişlikleri (başkası reddedilir: disk dolmasın). */
export const MEDIA_WIDTHS = [400, 800, 1600] as const;
const SIGNED_TTL_S = 5 * 60;
const unsupported = () => new AppError('UNSUPPORTED_TYPE', 'errors.unsupportedType', 415);
const DAY_MS = 864e5;

/** Kullanıcı başına sınırlar: disk ve işlemci tek hesapla doldurulamasın. */
export const MEDIA_LIMITS = {
  uploadsPerDay: 100,
  bytesPerUser: 300 * 1024 * 1024,
  /** Sıkıştırma bombasına karşı: çözülmüş görsel en fazla bu kadar piksel (ör. 8000 × 6250). */
  maxPixels: 50_000_000,
  /** İlana bağlanmamış herkese açık görsel bu süre açılabilir (yükleme sürerken önizleme), sonra 404. */
  orphanVisibleMs: DAY_MS,
  /** İlana ya da başvuruya bağlanmamış dosya bu süreden sonra silinir. */
  orphanSweepMs: 7 * DAY_MS,
} as const;

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE) private readonly storage: Storage, private readonly audit: AuditService) {}

  /**
   * Türü dosya adına ya da istemcinin söylediğine göre değil içeriğe göre belirler.
   * Resimler yeniden kodlanır: yön düzeltilir, uzun kenar 2000 px'e indirilir, EXIF (konum dahil) atılır.
   * PDF yalnızca korumalı belgeler için kabul edilir.
   */
  async upload(ownerId: string, buf: Buffer, visibility: Visibility) {
    await this.assertQuota(ownerId, buf.length);
    let out: Buffer;
    let mime: string;
    if (visibility === 'private' && buf.subarray(0, 5).toString('latin1') === '%PDF-') {
      out = buf;
      mime = 'application/pdf';
    } else {
      const opts = { limitInputPixels: MEDIA_LIMITS.maxPixels };
      const meta = await sharp(buf, opts).metadata().catch(() => null);
      if (!meta?.format || !IMAGE_FORMATS.has(meta.format)) throw unsupported();
      if ((meta.width ?? 0) * (meta.height ?? 0) > MEDIA_LIMITS.maxPixels) throw Errors.bad('IMAGE_TOO_LARGE');
      out = await sharp(buf, opts).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      mime = 'image/jpeg';
    }
    const id = crypto.randomUUID();
    const key = `${visibility}/${id.slice(0, 2)}/${id}`;
    await this.storage.put(key, out);
    const phash = visibility === 'public' && mime === 'image/jpeg' ? await dhash(out).catch(() => null) : null;
    await this.prisma.file.create({ data: { id, ownerId, visibility, key, mime, size: out.length, phash } });
    return { id, url: visibility === 'public' ? `${env().PUBLIC_URL}/media/${id}` : undefined };
  }

  /** Günlük yükleme sayısı ve toplam disk payı. */
  private async assertQuota(ownerId: string, incoming: number) {
    const [today, used] = await Promise.all([
      this.prisma.file.count({ where: { ownerId, createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
      this.prisma.file.aggregate({ where: { ownerId }, _sum: { size: true } }),
    ]);
    if (today >= MEDIA_LIMITS.uploadsPerDay) throw Errors.tooMany('UPLOAD_LIMIT');
    if ((used._sum.size ?? 0) + incoming > MEDIA_LIMITS.bytesPerUser) throw Errors.conflict('STORAGE_QUOTA');
  }

  /**
   * Herkese açık dosya yalnızca kaldırılmamış bir ilanın fotoğrafıysa ya da yeni yüklendiyse (ilana bağlanmadan önceki
   * önizleme) açılır. Bağlantısı bilinen yetim dosya ve kaldırılan ilanın fotoğrafları kapanır; sahibi silinmişse de kapalı.
   */
  private async publicFile(id: string) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'public') throw Errors.notFound();
    const [gone, attached] = await Promise.all([
      this.prisma.user.count({ where: { id: f.ownerId, deletedAt: { not: null } } }),
      this.prisma.listingPhoto.findMany({ where: { fileId: id }, select: { listing: { select: { status: true } } } }),
    ]);
    if (gone) throw Errors.notFound();
    const visible = attached.length
      ? attached.some((p) => p.listing.status !== 'removed')
      : Date.now() - f.createdAt.getTime() < MEDIA_LIMITS.orphanVisibleMs;
    if (!visible) throw Errors.notFound();
    return f;
  }

  /** Herkese açık görselin küçültülmüş WebP'si; ilk istekte üretilir, diskte saklanır. */
  async readPublicWidth(id: string, w: number) {
    if (!(MEDIA_WIDTHS as readonly number[]).includes(w)) throw Errors.bad('BAD_WIDTH', { allowed: MEDIA_WIDTHS.join(',') });
    const f = await this.publicFile(id);
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
    const f = await this.publicFile(id);
    return this.read(f.key, f.mime);
  }

  /**
   * Korumalı dosya için 5 dakikalık imzalı bağlantı; yalnızca sahibi ya da moderatör.
   * Moderatörün başkasının belgesini (kimlik, ruhsat) açması denetim kaydına yazılır.
   */
  async signedUrl(id: string, userId: string, isModerator: boolean) {
    const f = await this.prisma.file.findUnique({ where: { id } });
    if (!f || f.visibility !== 'private' || (f.ownerId !== userId && !isModerator)) throw Errors.notFound();
    if (f.ownerId !== userId) await this.audit.log(userId, 'audit.privateFileViewed', { ownerId: f.ownerId }, 'file', f.id);
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

  /** Hiçbir ilana ya da başvuruya bağlanmamış, bir haftadan eski dosyaları küçük kopyalarıyla siler. */
  async sweepOrphans(now = new Date()) {
    const before = new Date(now.getTime() - MEDIA_LIMITS.orphanSweepMs);
    const old = await this.prisma.file.findMany({ where: { createdAt: { lt: before } }, select: { id: true, key: true } });
    if (!old.length) return 0;
    const ids = old.map((f) => f.id);
    const [photos, requests] = await Promise.all([
      this.prisma.listingPhoto.findMany({ where: { fileId: { in: ids } }, select: { fileId: true } }),
      this.prisma.verificationRequest.findMany({ where: { fileIds: { hasSome: ids } }, select: { fileIds: true } }),
    ]);
    const used = new Set([...photos.map((p) => p.fileId), ...requests.flatMap((r) => r.fileIds)]);
    const orphans = old.filter((f) => !used.has(f.id));
    await Promise.all(orphans.flatMap((f) => [f.key, ...MEDIA_WIDTHS.map((w) => `${f.key}.w${w}.webp`)]).map((k) => this.storage.remove(k)));
    await this.prisma.file.deleteMany({ where: { id: { in: orphans.map((f) => f.id) } } });
    return orphans.length;
  }

  /** İzi olmayan eski herkese açık görsellere iz çıkarır (her çalışmada en fazla `limit`). */
  async backfillHashes(limit = 500) {
    const rows = await this.prisma.file.findMany({ where: { visibility: 'public', phash: null, mime: 'image/jpeg' }, take: limit, select: { id: true, key: true } });
    for (const f of rows) {
      const data = await this.storage.get(f.key);
      // Okunamayan dosya boş izle işaretlenir: her çalışmada yeniden denenmesin.
      const phash = data ? await dhash(data).catch(() => '') : '';
      await this.prisma.file.update({ where: { id: f.id }, data: { phash } });
    }
    return rows.length;
  }

  private async read(key: string, mime: string) {
    const data = await this.storage.get(key);
    if (!data) throw Errors.notFound();
    return { data, mime };
  }
}

/** Günde bir yetim dosya temizliği (testte kapalı). */
@Injectable()
export class MediaJanitor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Media');
  private timer?: NodeJS.Timeout;

  constructor(private readonly media: MediaService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const run = () => this.media.sweepOrphans().then((n) => n && this.log.log(`${n} yetim dosya silindi`))
      .then(() => this.media.backfillHashes())
      .catch((e) => this.log.error(`Temizlik yapılamadı: ${e}`));
    run();
    this.timer = setInterval(run, DAY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
