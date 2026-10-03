import os from 'os';
import path from 'path';
import fs from 'fs';
import { startDb } from '../scripts/db';

/**
 * Test çalıştırması boyunca tek bir geçici PostgreSQL açar; her test dosyası kendi şemasını kullanır.
 * `TEST_DB_BASE_URL` verilmişse (CI'daki PostgreSQL servisi gibi) gömülü sunucu açılmaz, o kullanılır.
 */
export default async function globalSetup() {
  if (process.env.TEST_DB_BASE_URL) return;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tms-pg-'));
  const db = await startDb({ port: 54330, dataDir });
  (globalThis as any).__TMS_DB__ = { db, dataDir };
  process.env.TEST_DB_BASE_URL = db.url;
}
