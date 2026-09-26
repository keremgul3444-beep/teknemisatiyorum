import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { AuditService } from '../../common/audit.service';
import { phoneSchema } from '../auth/phone';

const companyBody = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(['galeri', 'broker', 'tersane', 'servis']),
  city: z.string().trim().min(2).max(40),
});
const memberBody = z.object({ phone: phoneSchema, role: z.enum(['admin', 'staff']) });

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Auth({ level: 2 })
  @Post()
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(companyBody)) b: z.infer<typeof companyBody>) {
    return this.prisma.company.create({ data: { ...b, members: { create: { userId: u.id, role: 'owner' } } } });
  }

  @Auth()
  @Get('mine')
  async mine(@CurrentUser() u: AuthUser) {
    return this.prisma.company.findMany({ where: { members: { some: { userId: u.id } } }, include: { members: true } });
  }

  /** Yalnızca firmanın sahibi ya da yöneticisi personel ekleyebilir; kişi önce uygulamada hesap açmış olmalı. */
  @Auth({ level: 2 })
  @Post(':id/members')
  async addMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(memberBody)) b: z.infer<typeof memberBody>) {
    const me = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: id, userId: u.id } } });
    if (!me || !['owner', 'admin'].includes(me.role)) throw Errors.notFound();
    const target = await this.prisma.user.findUnique({ where: { phone: b.phone } });
    if (!target || target.deletedAt) throw Errors.bad('USER_NOT_FOUND');
    // Sahibin rolü bu uç noktadan değişmez (yönetici sahibi düşüremez; sahip de kendini düşüremez).
    const cur = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: id, userId: target.id } } });
    if (cur?.role === 'owner') throw new AppError('OWNER_LOCKED', 'errors.owner_locked', 409);
    const m = await this.prisma.companyMember.upsert({
      where: { companyId_userId: { companyId: id, userId: target.id } },
      create: { companyId: id, userId: target.id, role: b.role },
      update: { role: b.role },
    });
    await this.audit.log(u.id, 'audit.memberChanged', { role: b.role, before: cur?.role ?? '-' }, 'company', id);
    return m;
  }
}
