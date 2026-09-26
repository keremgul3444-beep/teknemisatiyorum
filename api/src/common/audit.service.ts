import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Değiştirilemez işlem kaydı: yalnızca ekleme yapar. `action` bir çeviri anahtarıdır. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actorId: string | null, action: string, params?: Record<string, string>, targetType?: string, targetId?: string) {
    await this.prisma.auditLog.create({
      data: { actorId, action, params: (params ?? undefined) as Prisma.InputJsonValue | undefined, targetType, targetId },
    });
  }
}
