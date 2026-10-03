import { Body, Controller, Delete, Get, Global, HttpCode, Inject, Injectable, Module, Param, Post, Put } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { ZodPipe } from '../../common/zod.pipe';
import { prefsOf, type Prefs } from '../users/user.view';
import { isExpoPushToken, PUSH, pushTransportClass, type PushTransport } from '../../adapters/push';
import { pushText } from './push.texts';

/** Kapatılabilen bildirim türleri; listede olmayanlar (ilan onayı, belge sonucu…) hizmet bildirimidir, hep gider. */
const PREF_OF: Record<string, keyof Prefs> = { 'notif.newMessage': 'notifyMessages', 'notif.searchMatch': 'notifyMatches', 'notif.priceDrop': 'notifyMatches' };

/** Uygulama içi bildirimler (`key` bir çeviri anahtarıdır) ve aynı anda telefona anlık bildirim. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, @Inject(PUSH) private readonly transport: PushTransport) {}

  /** Kullanıcının kapattığı bildirim türü gönderilmez; pazarlama bildirimi ayrıca açık rıza ister. */
  async push(userId: string, key: string, params?: Record<string, string>) {
    const pref = PREF_OF[key] ?? (/^notif\.marketing/.test(key) ? 'notifyMarketing' : undefined);
    if (pref) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } });
      const p = u ? prefsOf(u) : null;
      if (!p || !p[pref] || (pref === 'notifyMarketing' && !p.marketingConsent)) return null;
    }
    const n = await this.prisma.notification.create({ data: { userId, key, params: params as Prisma.InputJsonValue | undefined } });
    // Telefona gönderim yanıtı bekletmez; hata uygulama içi bildirimi etkilemez.
    this.deliver(userId, key, params).catch((e) => console.warn(`Anlık bildirim: ${e instanceof Error ? e.message : e}`));
    return n;
  }

  /** Kullanıcının kayıtlı cihazlarına, kendi dilinde. Kayıtsız (uygulaması silinmiş) cihazın jetonu temizlenir. */
  private async deliver(userId: string, key: string, params?: Record<string, string>) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (!tokens.length) return;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { lang: true } });
    const text = pushText(u?.lang ?? 'tr', key, params);
    if (!text) return;
    const { invalidTokens } = await this.transport.send(tokens.map((t) => ({ to: t.token, ...text, data: { key, params: params ?? {} } })));
    if (invalidTokens.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
  }
}

const tokenBody = z.object({ token: z.string().refine(isExpoPushToken, 'Geçersiz bildirim jetonu'), platform: z.enum(['ios', 'android']) });

/** Cihaz kaydı: giriş sonrası uygulama jetonu bırakır, çıkışta siler. */
@Controller('me/push-token')
class PushTokenController {
  constructor(private readonly prisma: PrismaService) {}

  @Auth()
  @Put()
  @HttpCode(204)
  async register(@CurrentUser() u: AuthUser, @Body(new ZodPipe(tokenBody)) b: z.infer<typeof tokenBody>) {
    // Aynı telefon başka hesapla giriş yaptıysa jeton yeni hesaba geçer (eski hesaba bildirim sızmaz).
    await this.prisma.pushToken.upsert({ where: { token: b.token }, create: { userId: u.id, token: b.token, platform: b.platform }, update: { userId: u.id, platform: b.platform, lastSeenAt: new Date() } });
  }

  @Auth()
  @Delete(':token')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('token') token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId: u.id } });
  }
}

@Controller('notifications')
class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Auth()
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Auth()
  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.notification.updateMany({ where: { id, userId: u.id }, data: { readAt: new Date() } });
    if (!r.count) throw Errors.notFound();
  }
}

@Global()
@Module({ controllers: [NotificationsController, PushTokenController], providers: [NotificationsService, { provide: PUSH, useFactory: () => new (pushTransportClass())() }], exports: [NotificationsService, PUSH] })
export class NotificationsModule {}
