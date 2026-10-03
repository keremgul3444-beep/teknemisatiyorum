import fs from 'fs/promises';
import path from 'path';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env';
import { S3Client } from './s3';

export const STORAGE = Symbol('STORAGE');

/** Dosya depolama takma yuvası. Bulut depolama bağlanınca yalnızca bu arayüzün yeni uygulaması yazılır. */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

/** Yerel disk uygulaması. Anahtarlar sunucuda üretilir; yol dışına çıkış engellenir. */
@Injectable()
export class LocalDiskStorage implements Storage {
  private file(key: string) {
    const root = path.resolve(env().STORAGE_DIR);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Geçersiz depolama anahtarı');
    return full;
  }

  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, data);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.file(key));
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
}

/** Bulut uygulaması (S3 uyumlu). Anahtar biçimi diskle aynı: `public/ab/<id>`, `private/ab/<id>`, `backups/<gün>.json.enc`. */
@Injectable()
export class S3Storage implements Storage {
  private readonly s3: S3Client;
  constructor() {
    const e = env();
    this.s3 = new S3Client({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, bucket: e.S3_BUCKET, accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY });
  }
  put(key: string, data: Buffer) { return this.s3.put(key, data); }
  get(key: string) { return this.s3.get(key); }
  remove(key: string) { return this.s3.remove(key); }
}

/** Ortama göre depolama: `STORAGE_DRIVER=s3` ise bulut, değilse yerel disk. */
export const storageProvider = { provide: STORAGE, useFactory: (): Storage => (env().STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalDiskStorage()) };
