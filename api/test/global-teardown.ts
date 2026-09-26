import fs from 'fs';

export default async function globalTeardown() {
  const s = (globalThis as any).__TMS_DB__;
  if (!s) return;
  await s.db.stop();
  // Windows'ta sunucu kapandıktan hemen sonra dosyalar kısa süre kilitli kalabilir; geçici klasör en fazla birkaç kez denenir.
  fs.rmSync(s.dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
