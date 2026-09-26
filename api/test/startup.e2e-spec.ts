import { spawn, spawnSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_DIR = path.resolve(__dirname, '..');

test('kök geliştirme betiği derlenmiş API sürecine .env dosyasını yükler', () => {
  const script = fs.readFileSync(path.resolve(API_DIR, '..', 'scripts', 'dev.mjs'), 'utf8');
  expect(script).toContain("start('API', 'node', ['--env-file=.env', 'dist/src/main.js']");
});

test('çalıştırma rehberi yerel ve tünel komutlarını açıklar', () => {
  const readme = fs.readFileSync(path.resolve(API_DIR, '..', 'README.md'), 'utf8');
  expect(readme).toContain('npm run dev');
  expect(readme).toContain('npm run dev -- --tunnel');
  expect(readme).toContain('ANTHROPIC_API_KEY');
  expect(readme).toContain('EXPO_TOKEN');
});

async function waitForHealth(port: number, child: ChildProcess) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API açılmadan kapandı (${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {
      // Sunucu henüz dinlemiyorsa kısa süre sonra yeniden dene.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Derlenmiş API 20 saniye içinde sağlık yanıtı vermedi');
}

test('derlenmiş NestJS sunucusu decorator metadata ile açılır', async () => {
  const build = spawnSync('npm', ['run', 'build'], { cwd: API_DIR, encoding: 'utf8', shell: process.platform === 'win32' });
  expect({ status: build.status, stderr: build.stderr, stdout: build.stdout }).toMatchObject({ status: 0 });

  const port = 31_000 + Math.floor(Math.random() * 1_000);
  const child = spawn(process.execPath, ['dist/src/main.js'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:54329/postgres',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      ID_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
    },
    stdio: 'pipe',
  });
  let output = '';
  child.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await expect(waitForHealth(port, child)).resolves.toEqual({ ok: true });
  } catch (error) {
    throw new Error(`${String(error)}\n${output}`);
  } finally {
    const exited = child.exitCode !== null
      ? Promise.resolve()
      : new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill('SIGTERM');
    await exited;
  }
});
