import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';
import { PrismaService } from './common/prisma.service';
import { backfillNationalIdHashes } from './modules/verification/backfill';

/** Uygulamayı ortak ayarlarla yapılandırır; testler de aynı fonksiyonu kullanır. */
export function configureApp(app: INestApplication) {
  // Geliştirmede istekler Metro proxy'sinden (127.0.0.1) gelir; gerçek istemci IP'si X-Forwarded-For'dan okunur.
  (app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void }).set('trust proxy', 'loopback');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: env().CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: false });
  return app;
}

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  // Kimlik tekliği kuralından önce doğrulanmış kullanıcıların izi doldurulur (tekrar çalışması zararsız).
  // Veritabanına o an ulaşılamasa da sunucu açılır; iş bir sonraki açılışta yeniden denenir.
  await backfillNationalIdHashes(app.get(PrismaService)).then((bf) => {
    if (bf.filled) console.log(`Kimlik izi dolduruldu: ${bf.filled} kullanıcı`);
    for (const c of bf.conflicts) console.warn(`UYARI: aynı T.C. numarası iki hesapta — ${c.userId} (asıl: ${c.heldBy}); yönetici incelemeli`);
    if (bf.unreadable.length) console.warn(`UYARI: ${bf.unreadable.length} kimlik kaydı çözülemedi (ID_ENC_KEY değişmiş olabilir)`);
  }).catch((e) => console.warn(`UYARI: kimlik izi doldurma atlandı (${e instanceof Error ? e.message.split(/\r?\n/).find(Boolean) : e})`));
  await app.listen(env().PORT);
  console.log(`API hazır: http://localhost:${env().PORT}`);
}

if (require.main === module) bootstrap();
