import { Controller, Get, Global, Module } from '@nestjs/common';
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
import { DevSmsSender, SMS_SENDER } from './adapters/sms';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MediaModule } from './modules/media/media.module';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
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
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    AuditService,
    DevSmsSender,
    { provide: SMS_SENDER, useExisting: DevSmsSender },
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
  exports: [PrismaService, AuditService, DevSmsSender, SMS_SENDER, CLOCK],
})
export class AppModule {}
