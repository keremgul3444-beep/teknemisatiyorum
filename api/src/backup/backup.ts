import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { STORAGE, type Storage } from '../adapters/storage';

const KEEP = 7;
const DAY_MS = 24 * 60 * 60_000;
/** Buluttaki şifreli yedekler daha uzun tutulur (sunucu diski kaybolsa da bir ay geriye dönülebilsin). */
const KEEP_OFFSITE = 30;

/** Yedek şifreleme anahtarı ID_ENC_KEY'den türetilir: geri yüklemek için aynı .env gerekir (scripts/backup-decrypt.ts). */
const backupKey = () => crypto.createHmac('sha256', Buffer.from(env().ID_ENC_KEY, 'base64')).update('offsite-backup').digest();

/** Sıkıştır + AES-256-GCM. Biçim: 12 bayt iv | 16 bayt etiket | şifreli veri. */
export function sealBackup(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', backupKey(), iv);
  const data = Buffer.concat([c.update(zlib.gzipSync(plain)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]);
}

export function openBackup(sealed: Buffer): Buffer {
  const d = crypto.createDecipheriv('aes-256-gcm', backupKey(), sealed.subarray(0, 12));
  d.setAuthTag(sealed.subarray(12, 28));
  return zlib.gunzipSync(Buffer.concat([d.update(sealed.subarray(28)), d.final()]));
}

/** Günün yedeğini şifreleyip buluta yazar, 30 günden eskisini siler. */
export async function pushOffsite(storage: Storage, file: string, now = new Date()) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  await storage.put(`backups/${day(now)}.json.enc`, sealBackup(await fs.readFile(file)));
  await storage.remove(`backups/${day(new Date(now.getTime() - KEEP_OFFSITE * DAY_MS))}.json.enc`);
}

/**
 * Mantıksal yedek: her tablonun satırları tek bir günlük JSON dosyasına yazılır, son 7 gün tutulur.
 * Paketlenmiş PostgreSQL'de pg_dump bulunmadığı için bu yol seçildi; dosyalar (fotoğraf/belge) depolama klasöründe ayrıca durur.
 */
export async function runBackup(prisma: PrismaClient, dir: string, now = new Date()) {
  const tables: Record<string, unknown[]> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const key = model.name[0].toLowerCase() + model.name.slice(1);
    tables[key] = await (prisma as unknown as Record<string, { findMany(): Promise<unknown[]> }>)[key].findMany();
  }
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${now.toISOString().slice(0, 10)}.json`);
  await fs.writeFile(file, JSON.stringify({ createdAt: now.toISOString(), tables }));
  const all = (await fs.readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  await Promise.all(all.slice(0, Math.max(0, all.length - KEEP)).map((f) => fs.rm(path.join(dir, f))));
  return file;
}

/** Sunucu açılınca o günün yedeği yoksa alır, sonra her 24 saatte bir tekrarlar (test ortamında çalışmaz). */
@Injectable()
export class BackupScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Backup');
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, @Inject(STORAGE) private readonly storage: Storage) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const dir = path.resolve(process.cwd(), 'backups');
    const run = () => runBackup(this.prisma, dir)
      .then(async (f) => {
        this.log.log(`Yedek alındı: ${f}`);
        if (env().BACKUP_OFFSITE === '1') { await pushOffsite(this.storage, f); this.log.log('Şifreli yedek buluta yazıldı'); }
      })
      .catch((e) => this.log.error(`Yedek alınamadı: ${e}`));
    run();
    this.timer = setInterval(run, DAY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
