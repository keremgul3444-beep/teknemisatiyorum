import { Controller, Get, Global, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { AuditService } from './common/audit.service';
import { AuthGuard } from './common/auth.guard';
import { ErrorFilter } from './common/error.filter';
import { Public } from './common/decorators';
import { env } from './config/env';
import { CLOCK, systemClock } from './common/clock';
import { DevSmsSender, SMS_SENDER, smsSenderFor } from './adapters/sms';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MediaModule } from './modules/media/media.module';
import { ListingsModule } from './modules/listings/listings.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { BoatsModule } from './modules/boats/boats.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ServicesModule } from './modules/services/services.module';
import { AdminModule } from './modules/admin/admin.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { BackupScheduler } from './backup/backup';

/** `/health`: süreç ayakta mı. `/health/ready`: veritabanıyla birlikte hizmet veriyor mu (kesinti takibi bunu yoklar). */
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  health() {
    return { ok: true };
  }

  @Public()
  @Get('ready')
  async ready() {
    const ok = await Promise.race([
      this.prisma.$queryRaw`SELECT 1`.then(() => true, () => false),
      new Promise<boolean>((r) => setTimeout(() => r(false), 3000).unref()),
    ]);
    if (!ok) throw new ServiceUnavailableException();
    return { ok: true };
  }
}

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({ global: true, useFactory: () => ({ secret: env().JWT_SECRET, signOptions: { expiresIn: '15m' } }) }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AuthModule,
    MediaModule,
    UsersModule,
    ListingsModule,
    AssistantModule,
    NotificationsModule,
    BoatsModule,
    MessagesModule,
    ServicesModule,
    AdminModule,
    PromotionsModule,
    MarketplaceModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    AuditService,
    BackupScheduler,
    DevSmsSender,
    { provide: SMS_SENDER, useFactory: smsSenderFor, inject: [DevSmsSender] },
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
  exports: [PrismaService, AuditService, DevSmsSender, SMS_SENDER, CLOCK],
})
export class AppModule {}
