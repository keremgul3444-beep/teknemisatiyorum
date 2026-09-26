import 'reflect-metadata';
import { execSync } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { resetEnvCache } from '../src/config/env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { PrismaService } from '../src/common/prisma.service';

export interface TestApp { app: INestApplication; prisma: PrismaService; http: () => ReturnType<typeof request>; close(): Promise<void> }

/**
 * Her test dosyası için ayrı bir PostgreSQL şeması açar, migration'ları uygular ve uygulamayı başlatır.
 * `override` ile adaptörler (SMS, LLM, saat) sahte uygulamalarla değiştirilebilir.
 */
export async function createTestApp(opts: { controllers?: any[]; override?: (b: import('@nestjs/testing').TestingModuleBuilder) => void } = {}): Promise<TestApp> {
  const schema = `t_${crypto.randomBytes(5).toString('hex')}`;
  const url = `${process.env.TEST_DB_BASE_URL}?schema=${schema}`;
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    ID_ENC_KEY: Buffer.alloc(32, 7).toString('base64'),
    STORAGE_DIR: path.join(require('os').tmpdir(), `tms-storage-${schema}`),
    ANTHROPIC_API_KEY: '',
    OTP_IP_LIMIT: '1000',
  });
  resetEnvCache();
  execSync('npx prisma migrate deploy', { cwd: path.resolve(__dirname, '..'), env: process.env, stdio: 'ignore' });

  const builder = Test.createTestingModule({ imports: [AppModule], controllers: opts.controllers ?? [] });
  opts.override?.(builder);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);
  return {
    app, prisma,
    http: () => request(app.getHttpServer()),
    async close() {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await app.close();
    },
  };
}
