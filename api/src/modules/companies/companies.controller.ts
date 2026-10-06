import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { AuditService } from '../../common/audit.service';
import { maskPhone } from '@tms/shared';
import { phoneSchema } from '../auth/phone';
import { ListingsService } from '../listings/listings.service';
import { listingInclude } from '../listings/listing.view';
import { NotificationsService } from '../notifications/notifications.module';

const companyBody = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(['galeri', 'broker', 'tersane', 'servis']),
  city: z.string().trim().min(2).max(40),
});
const memberBody = z.object({ phone: phoneSchema, role: z.enum(['admin', 'staff']) });

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly listings: ListingsService, private readonly notifications: NotificationsService) {}

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
    if (!cur) {
      const c = await this.prisma.company.findUnique({ where: { id }, select: { name: true } });
      await this.notifications.push(target.id, 'notif.companyAdded', { company: c?.name ?? '' });
    }
    return m;
  }

  /**
   * Firma paneli: firma, personel (telefon maskeli) ve firmanın ilanları istatistikleriyle. Yalnızca üyeler görür;
   * ilan istatistikleri ve yönetim yalnızca sahip ve yöneticiye (personel kendi ilanlarını İlanlarım'da görür).
   */
  @Auth()
  @Get(':id')
  async detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const me = await this.member(id, u.id);
    const c = await this.prisma.company.findUniqueOrThrow({ where: { id }, include: { members: true } });
    const users = await this.prisma.user.findMany({ where: { id: { in: c.members.map((m) => m.userId) } }, select: { id: true, name: true, phone: true, deletedAt: true } });
    const manager = ['owner', 'admin'].includes(me.role);
    const rows = await this.prisma.listing.findMany({
      where: { companyId: id, status: { in: ['pending', 'published', 'rejected', 'sold', 'expired'] } },
      include: listingInclude, orderBy: { updatedAt: 'desc' }, take: 200,
    });
    const stats = manager ? await this.listings.statsFor(rows) : new Map();
    const nameOf = (uid: string) => users.find((x) => x.id === uid)?.name ?? null;
    return {
      id: c.id, name: c.name, kind: c.kind, city: c.city, myRole: me.role,
      members: c.members.map((m) => {
        const usr = users.find((x) => x.id === m.userId);
        return { userId: m.userId, role: m.role, name: usr?.deletedAt ? null : usr?.name ?? null, phone: usr?.phone ? maskPhone(usr.phone) : null, me: m.userId === u.id };
      }),
      listings: rows.map((l) => ({
        id: l.id, title: `${l.brand} ${l.model}`, year: l.year, price: l.price, currency: l.currency, status: l.status,
        ownerName: nameOf(l.ownerId), cover: l.photos[0] ? `/media/${l.photos[0].fileId}` : null,
        expiresAt: l.expiresAt?.toISOString() ?? null, ...(manager ? { stats: stats.get(l.id) } : {}),
      })),
    };
  }

  /** Personeli firmadan çıkar (sahip ya da yönetici; sahip çıkarılamaz). Kişinin firma adına verdiği ilanlar firmada kalır (firma sahibine geçer). */
  @Auth({ level: 2 })
  @Delete(':id/members/:userId')
  @HttpCode(204)
  async removeMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    const me = await this.member(id, u.id);
    if (!['owner', 'admin'].includes(me.role)) throw Errors.notFound();
    const target = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId: id, userId } } });
    if (!target) throw Errors.notFound();
    if (target.role === 'owner') throw new AppError('OWNER_LOCKED', 'errors.owner_locked', 409);
    const moved = await this.leave(id, userId);
    await this.audit.log(u.id, 'audit.memberRemoved', { role: target.role, listings: String(moved) }, 'company', id);
    const c = await this.prisma.company.findUnique({ where: { id }, select: { name: true } });
    await this.notifications.push(userId, 'notif.companyRemoved', { company: c?.name ?? '' });
  }

  /** Personel firmadan kendisi ayrılır (sahip ayrılamaz). Firma adına verdiği ilanlar firmada kalır. */
  @Auth()
  @Post(':id/leave')
  @HttpCode(204)
  async leaveSelf(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const me = await this.member(id, u.id);
    if (me.role === 'owner') throw new AppError('OWNER_LOCKED', 'errors.owner_locked', 409);
    const moved = await this.leave(id, u.id);
    await this.audit.log(u.id, 'audit.memberLeft', { listings: String(moved) }, 'company', id);
  }

  /** Üyelik silinir; kişinin firma adına verdiği ilanlar firma sahibine geçer (envanter firmanındır). */
  private async leave(companyId: string, userId: string) {
    const owner = await this.prisma.companyMember.findFirst({ where: { companyId, role: 'owner' } });
    const [, moved] = await this.prisma.$transaction([
      this.prisma.companyMember.delete({ where: { companyId_userId: { companyId, userId } } }),
      owner
        ? this.prisma.listing.updateMany({ where: { companyId, ownerId: userId, status: { notIn: ['removed', 'sold'] } }, data: { ownerId: owner.userId } })
        : this.prisma.listing.updateMany({ where: { companyId, ownerId: userId }, data: { companyId: null } }),
    ]);
    return moved.count;
  }

  private async member(companyId: string, userId: string) {
    const m = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
    if (!m) throw Errors.notFound();
    return m;
  }
}
