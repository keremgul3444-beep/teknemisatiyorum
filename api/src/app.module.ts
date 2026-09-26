import { Controller, Get, Global, Module } from '@nestjs/common';
import { PrismaService } from './common/prisma.service';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}

@Global()
@Module({
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
