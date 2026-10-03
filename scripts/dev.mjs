// Tek komutla kapalı beta: yerel PostgreSQL → migration → (boşsa) başlangıç verisi → API → Expo (+ isteğe bağlı site).
// Kullanım:  npm run dev                       (bu bilgisayarda: web ve aynı ağdaki telefon)
//            npm run dev -- --tunnel           (her yerden telefon; EXPO_TOKEN ortamda olmalı)
//            npm run dev -- --web              (site de açılır: http://localhost:3001)
//            npm run dev -- --web --no-mobile  (yalnızca site; bellek az olduğunda)
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
const withWeb = process.argv.includes('--web');
const noMobile = process.argv.includes('--no-mobile');
const isWin = process.platform === 'win32';

// 1) Gizli değerler: .env yoksa rastgele üretilir (yalnızca bu bilgisayarda kalır, git'e girmez).
if (!fs.existsSync(ENV_FILE)) {
  const example = fs.readFileSync(path.join(API, '.env.example'), 'utf8');
  fs.writeFileSync(ENV_FILE, example
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('base64')}`)
    .replace(/^ID_ENC_KEY=.*$/m, `ID_ENC_KEY=${crypto.randomBytes(32).toString('base64')}`)
    // Yalnızca bu bilgisayar: geliştirme ortamı, SMS yokken kod uygulamada görünür, yerel IP sınırı yükseltilir.
    .replace(/^NODE_ENV=.*$/m, 'NODE_ENV=development')
    .replace(/^DEV_OTP_ECHO=.*$/m, 'DEV_OTP_ECHO=1')
    .replace(/^OTP_IP_LIMIT=.*$/m, 'OTP_IP_LIMIT=200'));
  console.log('api/.env oluşturuldu (rastgele gizli anahtarlarla).');
}
// Sonradan eklenen gizli değerler: mevcut .env'de yoksa eklenir (öncekiler değişmez).
{
  let cur = fs.readFileSync(ENV_FILE, 'utf8');
  if (!/^PAYMENT_WEBHOOK_SECRET=.+$/m.test(cur)) {
    cur = cur.replace(/^PAYMENT_WEBHOOK_SECRET=.*\r?\n?/m, '').replace(/\s*$/, '\n') + `PAYMENT_WEBHOOK_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
    fs.writeFileSync(ENV_FILE, cur);
    console.log('api/.env: ödeme bildirimi imza anahtarı eklendi.');
  }
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
function run(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin, env: env ? { ...process.env, ...env } : process.env });
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
// Yerel geliştirmede demo ilanlar da yüklenir (canlıda SEED_DEMO yok: yalnızca yönetici, kurlar, paketler, ürünler).
run('node', [...nodeEnv, 'prisma/seed.ts'], API, { SEED_DEMO: '1' });
start('API', 'node', ['--env-file=.env', 'dist/src/main.js'], { cwd: API });
await waitPort(3000);
if (withWeb) {
  // Site API'ye sunucu tarafından bağlanır (tarayıcı API'yi görmez; CORS gerekmez).
  start('Site', 'npm', ['run', 'dev'], { cwd: path.join(ROOT, 'web'), env: { ...process.env, API_URL: 'http://127.0.0.1:3000' } });
}
if (!noMobile) {
  start('Expo', 'npx', ['expo', 'start', ...(tunnel ? ['--tunnel'] : [])], {
    cwd: MOBILE,
    env: { ...process.env, EXPO_PUBLIC_API_PROXY: '1' },
  });
}
