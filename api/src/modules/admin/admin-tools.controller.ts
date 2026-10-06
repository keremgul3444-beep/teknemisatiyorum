import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { maskPhone } from '@tms/shared';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { NotificationsService } from '../notifications/notifications.module';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
/** Rol değiştirmek yalnızca yöneticinin işi. */
const ADMIN = { roles: ['admin'] as ('moderator' | 'admin')[] };
const rolesBody = z.object({ roles: z.array(z.enum(['moderator', 'admin'])).max(2) });
const providerBody = z.object({ status: z.enum(['active', 'suspended']) });
const selfDecision = () => new AppError('SELF_DECISION', 'errors.self_decision', 403);

/**
 * SQL gerektiren rutin ekip işleri: kullanıcı ayrıntısı, rol verme, kaldırılan ilanı geri alma, yorum gizleme,
 * hizmet profilini durdurma. Her işlem kayda geçer; kimse kendi hesabına ya da ilanına karar veremez.
 */
@Controller('admin')
export class AdminToolsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tek kullanıcı: ilanları, verdiği ve aldığı bildirimler, ödemeler, hizmet profilleri ve son işlem kayıtları. */
  @Auth(STAFF)
  @Get('users/:id')
  async user(@Param('id') id: string) {
    const x = await this.prisma.user.findUnique({ where: { id } });
    if (!x) throw Errors.notFound();
    const [listings, filed, received, payments, providers, audit, companies] = await Promise.all([
      this.prisma.listing.findMany({ where: { ownerId: id }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, brand: true, model: true, year: true, status: true, removedReason: true, price: true, currency: true, updatedAt: true } }),
      this.prisma.listingReport.count({ where: { reporterId: id } }),
      this.prisma.listingReport.count({ where: { listing: { ownerId: id } } }),
      this.prisma.servicePayment.findMany({ where: { payerId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, amountKurus: true, disputedAt: true, createdAt: true } }),
      this.prisma.providerProfile.findMany({ where: { userId: id }, select: { id: true, kind: true, status: true, displayName: true, ratingSum: true, ratingCount: true } }),
      this.prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { targetId: id }] }, orderBy: { at: 'desc' }, take: 30 }),
      this.prisma.companyMember.findMany({ where: { userId: id }, include: { company: { select: { id: true, name: true } } } }),
    ]);
    return {
      id: x.id, name: x.name, roles: x.roles, verifyLevel: x.verifyLevel, createdAt: x.createdAt, deleted: !!x.deletedAt,
      suspendedAt: x.suspendedAt, suspendReason: x.suspendReason, reregistered: !!x.reregisteredFrom,
      phone: x.phone ? maskPhone(x.phone) : null, nationalId: x.nationalIdLast2 ? `•••••••••${x.nationalIdLast2}` : null,
      listings, reports: { filed, received }, payments, providers, audit, companies: companies.map((m) => ({ id: m.company.id, name: m.company.name, role: m.role })),
    };
  }

  /** Ekip rolleri (moderatör, yönetici). Kişi kendi rolünü değiştiremez; son yönetici yetkisini kaybetmez. */
  @Auth(ADMIN)
  @Post('users/:id/roles')
  @HttpCode(200)
  async roles(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(rolesBody)) b: z.infer<typeof rolesBody>) {
    if (id === u.id) throw selfDecision();
    const x = await this.prisma.user.findUnique({ where: { id } });
    if (!x || x.deletedAt) throw Errors.notFound();
    if (x.suspendedAt && b.roles.length) throw Errors.conflict('ALREADY_SUSPENDED');
    const roles = ['user' as const, ...[...new Set(b.roles)]];
    if (x.roles.includes('admin') && !roles.includes('admin')) {
      const admins = await this.prisma.user.count({ where: { roles: { has: 'admin' }, deletedAt: null, id: { not: id } } });
      if (!admins) throw Errors.conflict('LAST_ADMIN');
    }
    await this.prisma.user.update({ where: { id }, data: { roles } });
    await this.audit.log(u.id, 'audit.rolesChanged', { name: x.name ?? '—', roles: roles.filter((r) => r !== 'user').join(',') || '—' }, 'user', id);
    return { id, roles };
  }

  /** Ekibin kaldırdığı ilanı yeniden onaya alır (yanlış kaldırma ya da askı kalktıktan sonra). Sahibinin kaldırdığı ilan geri alınmaz. */
  @Auth(STAFF)
  @Post('listings/:id/restore')
  @HttpCode(200)
  async restore(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: { owner: { select: { suspendedAt: true, deletedAt: true } } } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw selfDecision();
    if (l.status !== 'removed' || !l.removedReason) throw Errors.conflict('NOT_RESTORABLE');
    if (l.owner.suspendedAt || l.owner.deletedAt) throw Errors.conflict('OWNER_SUSPENDED');
    await this.prisma.listing.update({ where: { id }, data: { status: 'pending', removedReason: null } });
    await this.audit.log(u.id, 'audit.listingRestored', { title: `${l.brand} ${l.model}` }, 'listing', id);
    return { id, status: 'pending' };
  }

  /** Son yorumlar (gizlenenler dahil); hizmet verenin adıyla. */
  @Auth(STAFF)
  @Get('reviews')
  async reviews(@Query('hidden') hidden?: string) {
    const rows = await this.prisma.review.findMany({ where: hidden === '1' ? { hiddenAt: { not: null } } : {}, orderBy: { createdAt: 'desc' }, take: 100 });
    const provs = await this.prisma.providerProfile.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.providerId))] } }, select: { id: true, displayName: true, kind: true } });
    return rows.map((r) => ({ ...r, provider: provs.find((p) => p.id === r.providerId) ?? null }));
  }

  /** Yorumu gizle / geri aç: puan ortalaması aynı işlemde güncellenir. */
  @Auth(STAFF)
  @Post('reviews/:id/hide')
  @HttpCode(200)
  hideReview(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.review(u, id, 'hide');
  }

  @Auth(STAFF)
  @Post('reviews/:id/show')
  @HttpCode(200)
  showReview(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.review(u, id, 'show');
  }

  private async review(u: AuthUser, id: string, action: 'hide' | 'show') {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw Errors.notFound();
    if (r.authorId === u.id) throw selfDecision();
    const hide = action === 'hide';
    await this.prisma.$transaction(async (tx) => {
      const n = await tx.review.updateMany({ where: { id, hiddenAt: hide ? null : { not: null } }, data: { hiddenAt: hide ? new Date() : null } });
      if (!n.count) throw Errors.conflict('ALREADY_DONE');
      await tx.providerProfile.update({ where: { id: r.providerId }, data: hide ? { ratingSum: { decrement: r.stars }, ratingCount: { decrement: 1 } } : { ratingSum: { increment: r.stars }, ratingCount: { increment: 1 } } });
    });
    await this.audit.log(u.id, hide ? 'audit.reviewHidden' : 'audit.reviewShown', { stars: String(r.stars) }, 'review', id);
    return { id, hidden: hide };
  }

  /** Tek hizmet profilini durdur ya da aç (hesabın geri kalanı etkilenmez). */
  @Auth(STAFF)
  @Post('providers/:id/status')
  @HttpCode(200)
  async provider(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(providerBody)) b: z.infer<typeof providerBody>) {
    const p = await this.prisma.providerProfile.findUnique({ where: { id } });
    if (!p) throw Errors.notFound();
    if (p.userId === u.id) throw selfDecision();
    const from = b.status === 'suspended' ? 'active' : 'suspended';
    const r = await this.prisma.providerProfile.updateMany({ where: { id, status: from }, data: { status: b.status } });
    if (!r.count) throw Errors.conflict('ALREADY_DONE');
    if (b.status === 'suspended') await this.notifications.push(p.userId, 'notif.providerSuspended', { name: p.displayName });
    await this.audit.log(u.id, b.status === 'suspended' ? 'audit.providerSuspended' : 'audit.providerActivated', { name: p.displayName }, 'provider', id);
    return { id, status: b.status };
  }
}
