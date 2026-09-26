import fs from 'fs';
import path from 'path';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { createTestApp, type TestApp } from './setup';
import { Auth, CurrentUser, Public, type AuthUser } from '../src/common/decorators';
import { ZodPipe } from '../src/common/zod.pipe';
import { AuditService } from '../src/common/audit.service';

@Controller('t')
class ProbeController {
  @Get('closed') closed() { return { ok: true }; }
  @Public() @Get('open') open() { return { ok: true }; }
  @Auth({ level: 2 }) @Get('level2') level2(@CurrentUser() u: AuthUser) { return { id: u.id }; }
  @Auth({ roles: ['admin'] }) @Get('admin') admin() { return { ok: true }; }
  @Public() @Post('validate') validate(@Body(new ZodPipe(z.object({ n: z.number() }))) b: { n: number }) { return b; }
  @Public() @Get('boom') boom() { throw new Error('gizli iç ayrıntı'); }
}

let t: TestApp;
let jwt: JwtService;
const token = (sub: string, sid = 'none') => jwt.sign({ sub, sid });

beforeAll(async () => {
  t = await createTestApp({ controllers: [ProbeController] });
  jwt = t.app.get(JwtService);
});
afterAll(async () => { await t.close(); });

test('bildirimsiz uç nokta varsayılan olarak kapalı', async () => {
  const r = await t.http().get('/t/closed');
  expect(r.status).toBe(401);
  expect(r.body).toMatchObject({ code: 'UNAUTHENTICATED', messageKey: 'errors.unauthenticated' });
});

test('@Public açık', async () => {
  expect((await t.http().get('/t/open')).status).toBe(200);
});

test('seviye yetmezse LEVEL_REQUIRED ve gereken seviye', async () => {
  const u = await t.prisma.user.create({ data: { phone: '+905550000001', verifyLevel: 1 } });
  const r = await t.http().get('/t/level2').set('Authorization', `Bearer ${token(u.id)}`);
  expect(r.status).toBe(403);
  expect(r.body).toEqual({ code: 'LEVEL_REQUIRED', messageKey: 'errors.levelRequired', params: { level: 2 } });
});

test('seviye güncellenince aynı anahtarla geçer (seviye her istekte veritabanından okunur)', async () => {
  const u = await t.prisma.user.create({ data: { phone: '+905550000002', verifyLevel: 1 } });
  await t.prisma.user.update({ where: { id: u.id }, data: { verifyLevel: 2 } });
  const r = await t.http().get('/t/level2').set('Authorization', `Bearer ${token(u.id)}`);
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ id: u.id });
});

test('silinmiş kullanıcının anahtarı geçersiz', async () => {
  const u = await t.prisma.user.create({ data: { phone: '+905550000003', verifyLevel: 3, deletedAt: new Date() } });
  expect((await t.http().get('/t/level2').set('Authorization', `Bearer ${token(u.id)}`)).status).toBe(401);
});

test('rol eksikse FORBIDDEN', async () => {
  const u = await t.prisma.user.create({ data: { phone: '+905550000004', verifyLevel: 3 } });
  const r = await t.http().get('/t/admin').set('Authorization', `Bearer ${token(u.id)}`);
  expect(r.status).toBe(403);
  expect(r.body.code).toBe('FORBIDDEN');
});

test('bozuk anahtar 401', async () => {
  expect((await t.http().get('/t/level2').set('Authorization', 'Bearer x.y.z')).status).toBe(401);
});

test('doğrulama hatası biçimi', async () => {
  const r = await t.http().post('/t/validate').send({ n: 'a' });
  expect(r.status).toBe(400);
  expect(r.body).toMatchObject({ code: 'VALIDATION', messageKey: 'errors.validation' });
});

test('beklenmeyen hata iç ayrıntı sızdırmaz', async () => {
  const r = await t.http().get('/t/boom');
  expect(r.status).toBe(500);
  expect(r.body).toEqual({ code: 'INTERNAL', messageKey: 'errors.internal' });
  expect(JSON.stringify(r.body)).not.toContain('gizli');
});

test('bilinmeyen yol 404 biçimi', async () => {
  const r = await t.http().get('/yok-boyle-bir-yol');
  expect(r.status).toBe(404);
  expect(r.body.code).toBe('NOT_FOUND');
});

test('işlem kaydı eklenir', async () => {
  await t.app.get(AuditService).log('u1', 'audit.test', { a: '1' }, 'listing', 'l1');
  const row = await t.prisma.auditLog.findFirst({ where: { action: 'audit.test' } });
  expect(row).toMatchObject({ actorId: 'u1', targetType: 'listing', targetId: 'l1', params: { a: '1' } });
});

test('işlem kaydını güncelleyen ya da silen kod yok', () => {
  const src = path.join(__dirname, '..', 'src');
  const all: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : all.push(fs.readFileSync(path.join(d, e.name), 'utf8')));
  walk(src);
  expect(all.join('\n')).not.toMatch(/auditLog\.(update|updateMany|delete|deleteMany|upsert)/);
});
