import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface RunningDb { url: string; stop(): Promise<void> }

const PLATFORM: Record<string, string> = { win32: 'windows', darwin: 'darwin', linux: 'linux' };

/** `embedded-postgres` paketinin getirdiği PostgreSQL ikili dosyalarının klasörü. */
function binDir(): string {
  const pkg = path.join('@embedded-postgres', `${PLATFORM[process.platform]}-${process.arch}`);
  // Paket 'exports' ile package.json'ı gizlediği için klasör node_modules'ta yukarı doğru aranır.
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', pkg, 'native', 'bin');
    if (fs.existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) throw new Error(`PostgreSQL ikili dosyaları bulunamadı: ${pkg}`);
  }
}
const bin = (name: string) => path.join(binDir(), process.platform === 'win32' ? `${name}.exe` : name);

/**
 * Kurulum gerektirmeyen yerel PostgreSQL'i başlatır.
 * `postgres` doğrudan değil `pg_ctl` ile başlatılır: pg_ctl Windows'ta yönetici yetkisini kendiliğinden düşürür,
 * doğrudan çalıştırılan sunucu ise yönetici oturumunda başlamayı reddeder.
 * Yalnızca 127.0.0.1'i dinler; kimlik doğrulama yereldeki güvenilir bağlantılarla sınırlıdır.
 */
export async function startDb({ port, dataDir }: { port: number; dataDir: string }): Promise<RunningDb> {
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    fs.mkdirSync(dataDir, { recursive: true });
    // Windows'un Türkçe bölge adı ASCII dışı karakter içerdiği için nötr yerel ayar verilir.
    execFileSync(bin('initdb'), ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--locale=C', '--encoding=UTF8'], { stdio: 'ignore' });
  }
  const log = path.join(dataDir, 'server.log');
  execFileSync(bin('pg_ctl'), ['start', '-w', '-D', dataDir, '-l', log, '-o', `-p ${port} -h 127.0.0.1`], { stdio: 'ignore' });
  return {
    url: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    stop: async () => { execFileSync(bin('pg_ctl'), ['stop', '-w', '-m', 'fast', '-D', dataDir], { stdio: 'ignore' }); },
  };
}

if (require.main === module) {
  const dataDir = path.resolve(__dirname, '..', '.data', 'pg');
  startDb({ port: Number(process.env.PG_PORT ?? 54329), dataDir }).then((db) => {
    console.log(`PostgreSQL hazır: ${db.url}`);
    const stop = () => db.stop().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}
