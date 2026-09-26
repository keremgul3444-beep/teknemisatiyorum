import fs from 'fs/promises';
import path from 'path';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env';

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
