import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';
import { PrismaService } from './common/prisma.service';
import { backfillNationalIdHashes } from './modules/verification/backfill';
import { normalizeListingLocations } from './modules/listings/location-backfill';
import { reportError } from './adapters/error-report';
import { appVersionGate } from './common/app-version';

/** Uygulamayı ortak ayarlarla yapılandırır; testler de aynı fonksiyonu kullanır. */
export function configureApp(app: INestApplication) {
  // Toplu ilan yüklemesinin CSV'si (100 satır, uzun açıklamalarla) varsayılan 100 KB'ı aşabilir.
  (app as INestApplication & { useBodyParser?: (t: string, o: { limit: string }) => void }).useBodyParser?.('json', { limit: '1mb' });
  // Geliştirmede istekler Metro proxy'sinden (127.0.0.1) gelir; gerçek istemci IP'si X-Forwarded-For'dan okunur.
  (app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void }).set('trust proxy', env().TRUST_PROXY);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(appVersionGate(() => ({ min: env().MIN_APP_VERSION, ios: env().APP_STORE_URL_IOS, android: env().APP_STORE_URL_ANDROID })));
  app.enableCors({ origin: env().CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: false });
  return app;
}

async function bootstrap() {
  // Yakalanmamış hatalar da hata takibine gider; çöken süreç bildirim gönderildikten sonra kapanır (Docker yeniden başlatır).
  process.on('unhandledRejection', (e) => { console.error('Yakalanmamış söz reddi:', e); void reportError(e, { job: 'unhandledRejection' }); });
  process.on('uncaughtException', (e) => {
    console.error('Yakalanmamış hata:', e);
    void reportError(e, { job: 'uncaughtException' }).finally(() => process.exit(1));
    setTimeout(() => process.exit(1), 3000).unref();
  });
  const app = configureApp(await NestFactory.create(AppModule, { rawBody: true }));
  // Kimlik tekliği kuralından önce doğrulanmış kullanıcıların izi doldurulur (tekrar çalışması zararsız).
  // Veritabanına o an ulaşılamasa da sunucu açılır; iş bir sonraki açılışta yeniden denenir.
  await backfillNationalIdHashes(app.get(PrismaService)).then((bf) => {
    if (bf.filled) console.log(`Kimlik izi dolduruldu: ${bf.filled} kullanıcı`);
    for (const c of bf.conflicts) console.warn(`UYARI: aynı T.C. numarası iki hesapta — ${c.userId} (asıl: ${c.heldBy}); yönetici incelemeli`);
    if (bf.unreadable.length) console.warn(`UYARI: ${bf.unreadable.length} kimlik kaydı çözülemedi (ID_ENC_KEY değişmiş olabilir)`);
  }).catch((e) => console.warn(`UYARI: kimlik izi doldurma atlandı (${e instanceof Error ? e.message.split(/\r?\n/).find(Boolean) : e})`));
  // Konum kuralından önceki ilanlar tek biçime getirilir ("bodrum" → "Bodrum"); tekrar çalışması zararsız.
  await normalizeListingLocations(app.get(PrismaService)).then((n) => {
    if (n) console.log(`Konum adı düzeltildi: ${n} ilan`);
  }).catch((e) => console.warn(`UYARI: konum düzeltme atlandı (${e instanceof Error ? e.message.split(/\r?\n/).find(Boolean) : e})`));
  await app.listen(env().PORT);
  console.log(`API hazır: http://localhost:${env().PORT}`);
}

if (require.main === module) bootstrap();
