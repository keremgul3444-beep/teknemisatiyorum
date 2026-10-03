import { z } from 'zod';

const schema = z.object({
  /** Varsayılan yok: ortam açıkça yazılmalı (unutulan bir yayın geliştirme ayarlarıyla açılmasın). */
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  /** 32 baytlık anahtarın base64 hali — kimlik numarası şifrelemesi için. */
  ID_ENC_KEY: z.string().refine((s) => Buffer.from(s, 'base64').length === 32, 'ID_ENC_KEY 32 bayt (base64) olmalı'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().default('claude-haiku-4-5'),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  STORAGE_DIR: z.string().default('storage'),
  /** Dosyalar nerede: local = sunucu diski (STORAGE_DIR), s3 = S3 uyumlu bulut (AWS S3, Cloudflare R2, Backblaze B2, MinIO). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /** Örn. https://<hesap>.r2.cloudflarestorage.com ya da https://s3.eu-central-1.amazonaws.com */
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  /** 1: günlük veritabanı yedeği şifrelenip ayrıca buluta da yazılır (STORAGE_DRIVER=s3 gerekir). */
  BACKUP_OFFSITE: z.enum(['0', '1']).default('0'),
  /** Boşsa medya bağlantıları göreli döner (önerilen); yalnızca farklı bir alan adından sunulacaksa doldurulur. */
  PUBLIC_URL: z.string().default(''),
  /** IP başına saatlik giriş kodu isteği sınırı. */
  OTP_IP_LIMIT: z.coerce.number().default(10),
  /** Kapalı beta: SMS bağlanana kadar giriş kodu yanıtta döner. Üretimde (NODE_ENV=production) hiçbir koşulda çalışmaz. */
  DEV_OTP_ECHO: z.enum(['0', '1']).default('0'),
  /** Ödeme sağlayıcıları: dev = deneme (gerçek para yok), live = gerçek (Aşama 2). */
  PAYMENTS_MODE: z.enum(['dev', 'live']).default('dev'),
  /** Ödeme bildirimi imza anahtarı (sanal POS paneli ile aynı değer). */
  PAYMENT_WEBHOOK_SECRET: z.string().min(32, 'PAYMENT_WEBHOOK_SECRET en az 32 karakter olmalı'),
  /** Sitenin adresi (ödeme dönüş ve deneme ödeme sayfası için). */
  WEB_URL: z.string().default('http://localhost:3001'),
  /** Anlık bildirim: expo = Expo Push servisi (telefona), off = yalnızca uygulama içi (geliştirme ve test). */
  PUSH_MODE: z.enum(['expo', 'off']).default('off'),
  /** Express "trust proxy": yalnızca bu ara katmandan gelen X-Forwarded-For'a güvenilir. */
  TRUST_PROXY: z.string().default('loopback'),
});

export type Env = z.infer<typeof schema>;

/** Bulut seçildiyse eksik ayar sunucuyu açılışta durdurur (yarım ayarla dosyalar sessizce kaybolmasın). */
function checkStorage(e: Env): string[] {
  const missing = e.STORAGE_DRIVER === 's3'
    ? (['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter((k) => !e[k]).map((k) => `  - ${k}: STORAGE_DRIVER=s3 için gerekli`)
    : [];
  if (e.BACKUP_OFFSITE === '1' && e.STORAGE_DRIVER !== 's3') missing.push('  - BACKUP_OFFSITE: STORAGE_DRIVER=s3 olmadan bulut yedeği alınamaz');
  return missing;
}

let cached: Env | undefined;
/** Ortam değişkenlerini doğrular; eksik gizli değerde süreç anlaşılır bir hatayla durur. */
export function env(): Env {
  if (cached) return cached;
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam ayarları geçersiz (api/.env):\n${msg}`);
  }
  const storage = checkStorage(r.data);
  if (storage.length) throw new Error(`Ortam ayarları geçersiz (api/.env):\n${storage.join('\n')}`);
  cached = r.data;
  return cached;
}

/** Testlerin ortamı değiştirdikten sonra önbelleği sıfırlaması için. */
export const resetEnvCache = () => { cached = undefined; };
