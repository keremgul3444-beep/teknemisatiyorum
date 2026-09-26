import fs from 'fs/promises';
import path from 'path';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';

const KEEP = 7;
const DAY_MS = 24 * 60 * 60_000;

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

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const dir = path.resolve(process.cwd(), 'backups');
    const run = () => runBackup(this.prisma, dir).then((f) => this.log.log(`Yedek alındı: ${f}`)).catch((e) => this.log.error(`Yedek alınamadı: ${e}`));
    run();
    this.timer = setInterval(run, DAY_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
