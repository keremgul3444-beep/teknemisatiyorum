import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  /** 32 baytlık anahtarın base64 hali — kimlik numarası şifrelemesi için. */
  ID_ENC_KEY: z.string().refine((s) => Buffer.from(s, 'base64').length === 32, 'ID_ENC_KEY 32 bayt (base64) olmalı'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().default('claude-haiku-4-5'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  STORAGE_DIR: z.string().default('storage'),
  /** Boşsa medya bağlantıları göreli döner (önerilen); yalnızca farklı bir alan adından sunulacaksa doldurulur. */
  PUBLIC_URL: z.string().default(''),
  /** IP başına saatlik giriş kodu isteği sınırı. */
  OTP_IP_LIMIT: z.coerce.number().default(10),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;
/** Ortam değişkenlerini doğrular; eksik gizli değerde süreç anlaşılır bir hatayla durur. */
export function env(): Env {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam ayarları geçersiz (api/.env):\n${msg}`);
  }
  cached = r.data;
  return cached;
}

/** Testlerin ortamı değiştirdikten sonra önbelleği sıfırlaması için. */
export const resetEnvCache = () => { cached = undefined; };
