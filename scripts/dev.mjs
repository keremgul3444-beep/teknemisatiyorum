// Tek komutla kapalı beta: yerel PostgreSQL → migration → (boşsa) başlangıç verisi → API → Expo.
// Kullanım:  npm run dev              (bu bilgisayarda: web ve aynı ağdaki telefon)
//            npm run dev -- --tunnel  (her yerden telefon; EXPO_TOKEN ortamda olmalı)
// Ctrl+C hepsini düzgün kapatır.
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const API = path.join(ROOT, 'api');
const MOBILE = path.join(ROOT, 'mobile');
const ENV_FILE = path.join(API, '.env');
const tunnel = process.argv.includes('--tunnel');
const isWin = process.platform === 'win32';

// 1) Gizli değerler: .env yoksa rastgele üretilir (yalnızca bu bilgisayarda kalır, git'e girmez).
if (!fs.existsSync(ENV_FILE)) {
  const example = fs.readFileSync(path.join(API, '.env.example'), 'utf8');
  fs.writeFileSync(ENV_FILE, example
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('base64')}`)
    .replace(/^ID_ENC_KEY=.*$/m, `ID_ENC_KEY=${crypto.randomBytes(32).toString('base64')}`));
  console.log('api/.env oluşturuldu (rastgele gizli anahtarlarla).');
}

const nodeEnv = ['--env-file=.env', '--import', 'tsx'];
const children = [];
function start(name, cmd, args, opts = {}) {
  // node doğrudan (kabuksuz) başlatılır ki durdurulabilsin; npx Windows'ta kabuk ister.
  const p = spawn(cmd, args, { stdio: 'inherit', shell: isWin && cmd !== 'node', ...opts });
  p.on('exit', (code) => { if (!shuttingDown) { console.log(`${name} kapandı (${code}); hepsi durduruluyor.`); shutdown(); } });
  children.push({ name, p });
  return p;
}
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} başarısız`);
}
const waitPort = (port) => new Promise((resolve) => {
  const tryOnce = () => net.connect(port, '127.0.0.1').on('connect', function () { this.end(); resolve(); }).on('error', () => setTimeout(tryOnce, 500));
  tryOnce();
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Önce uygulama ve API, en son veritabanı (db süreci SIGINT alınca pg_ctl stop çalıştırır).
  for (const { p } of [...children].reverse()) p.kill('SIGINT');
  // Windows'ta sinyal alt sürece ulaşmayabilir; veritabanı açıkça durdurulur.
  spawnSync('node', [...nodeEnv, 'scripts/db.ts', '--stop'], { cwd: API, stdio: 'inherit' });
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start('PostgreSQL', 'node', [...nodeEnv, 'scripts/db.ts'], { cwd: API });
await waitPort(54329);
// Beklenmedik kapanıştan sonra veritabanı port açıkken bir süre kendini toparlar; hazır olana kadar denenir.
for (let i = 1; ; i++) {
  try { run('npx', ['prisma', 'migrate', 'deploy'], API); break; } catch (e) { if (i >= 10) throw e; await new Promise((r) => setTimeout(r, 2000)); }
}
run('npm', ['run', 'build'], API);
run('node', [...nodeEnv, 'prisma/seed.ts'], API);
start('API', 'node', ['--env-file=.env', 'dist/src/main.js'], { cwd: API });
await waitPort(3000);
start('Expo', 'npx', ['expo', 'start', ...(tunnel ? ['--tunnel'] : [])], {
  cwd: MOBILE,
  env: { ...process.env, EXPO_PUBLIC_API_PROXY: '1' },
});
