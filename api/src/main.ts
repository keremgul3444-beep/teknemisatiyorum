import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config/env';

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
  await app.listen(env().PORT);
  console.log(`API hazır: http://localhost:${env().PORT}`);
}

if (require.main === module) bootstrap();
