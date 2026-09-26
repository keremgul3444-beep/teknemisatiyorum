import { Controller, Get, Global, HttpCode, Injectable, Module, Param, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';

/** Uygulama içi bildirimler; `key` bir çeviri anahtarıdır. Telefona düşen bildirimler sonraki tur. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  push(userId: string, key: string, params?: Record<string, string>) {
    return this.prisma.notification.create({ data: { userId, key, params: params as Prisma.InputJsonValue | undefined } });
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
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
