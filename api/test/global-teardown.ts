import fs from 'fs';

export default async function globalTeardown() {
  const s = (globalThis as any).__TMS_DB__;
  if (!s) return;
  await s.db.stop();
  fs.rmSync(s.dataDir, { recursive: true, force: true });
}
