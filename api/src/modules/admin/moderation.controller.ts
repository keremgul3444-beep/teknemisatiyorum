import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { TAKEDOWN_REASONS } from '@tms/shared';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { NotificationsService } from '../notifications/notifications.module';
import { restoreServices, retireServices } from '../marketplace/lifecycle';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
const takedownBody = z.object({ reason: z.enum(TAKEDOWN_REASONS) });
const suspendBody = z.object({ reason: z.string().trim().min(3).max(200) });
const selfDecision = () => new AppError('SELF_DECISION', 'errors.self_decision', 403);
/** Ekip üyeleri birbirini askıya alamaz; yetki yalnızca yönetici rolünün işi. */
const staffProtected = () => new AppError('STAFF_PROTECTED', 'errors.staff_protected', 403);
const LIVE: ('published' | 'pending' | 'sold')[] = ['published', 'pending', 'sold'];

/**
 * Şikayet ve yaptırım: bildirilen ilanlar kuyruğu, yayındaki ilanı kaldırma, bildirimi yoksayma, hesabı askıya alma.
 * Her karar işlem kaydına yazılır; moderatör kendi ilanına ya da hesabına karar veremez.
 */
@Controller('admin')
export class ModerationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Açık bildirimler ilana göre gruplanır; en çok bildirilen ve en eski önce. Bildirenin adı maskelenmez ama telefonu gönderilmez. */
  @Auth(STAFF)
  @Get('reports')
  async reports() {
    const open = await this.prisma.listingReport.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' }, take: 500 });
    const ids = [...new Set(open.map((r) => r.listingId))];
    const [listings, reporters] = await Promise.all([
      this.prisma.listing.findMany({ where: { id: { in: ids } }, include: { owner: { select: { id: true, name: true, verifyLevel: true, suspendedAt: true } } } }),
      this.prisma.user.findMany({ where: { id: { in: [...new Set(open.map((r) => r.reporterId))] } }, select: { id: true, name: true } }),
    ]);
    return listings
      .map((l) => {
        const rs = open.filter((r) => r.listingId === l.id);
        return {
          listing: {
            id: l.id, title: `${l.brand} ${l.model}`, year: l.year, price: l.price, currency: l.currency, status: l.status, description: l.description,
            owner: { id: l.owner.id, name: l.owner.name, verifyLevel: l.owner.verifyLevel, suspended: !!l.owner.suspendedAt },
          },
          count: rs.length,
          firstAt: rs[0].createdAt,
          reports: rs.map((r) => ({ id: r.id, reason: r.reason, note: r.note, createdAt: r.createdAt, reporterName: reporters.find((x) => x.id === r.reporterId)?.name ?? null })),
        };
      })
      .sort((a, b) => b.count - a.count || a.firstAt.getTime() - b.firstAt.getTime());
  }

  /** Yayındaki (ya da bekleyen, satılmış) ilanı kaldırır; açık bildirimler "işlem yapıldı" olur, sahibine gerekçeyle bildirim gider. */
  @Auth(STAFF)
  @Post('listings/:id/takedown')
  @HttpCode(200)
  async takedown(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(takedownBody)) b: z.infer<typeof takedownBody>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw selfDecision();
    const r = await this.prisma.listing.updateMany({ where: { id, status: { in: LIVE } }, data: { status: 'removed', removedReason: b.reason } });
    if (!r.count) throw Errors.conflict('LISTING_CLOSED');
    await this.resolveReports([id], 'actioned', u.id);
    const title = `${l.brand} ${l.model}`;
    await this.notifications.push(l.ownerId, 'notif.listingRemoved', { title, listingId: id, reason: b.reason });
    await this.audit.log(u.id, 'audit.listingRemoved', { title, reason: b.reason }, 'listing', id);
    return { status: 'removed', removedReason: b.reason };
  }

  /** İlanın açık bildirimlerini yoksayar (ilan yayında kalır). */
  @Auth(STAFF)
  @Post('listings/:id/reports/dismiss')
  @HttpCode(200)
  async dismiss(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw selfDecision();
    const n = await this.resolveReports([id], 'dismissed', u.id);
    await this.audit.log(u.id, 'audit.reportsDismissed', { title: `${l.brand} ${l.model}`, count: String(n) }, 'listing', id);
    return { dismissed: n };
  }

  /**
   * Hesabı askıya alır: tüm oturumlar kapanır, yeniden giriş engellenir, yayındaki/bekleyen ilanları kaldırılır
   * (gerekçe "account_suspended") ve bu ilanların açık bildirimleri kapanır. Askı kalkınca bu ilanlar yeniden onaya düşer.
   */
  @Auth(STAFF)
  @Post('users/:id/suspend')
  @HttpCode(200)
  async suspend(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(suspendBody)) b: z.infer<typeof suspendBody>) {
    if (id === u.id) throw selfDecision();
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw Errors.notFound();
    if (target.roles.some((r) => r === 'admin' || r === 'moderator')) throw staffProtected();
    if (target.suspendedAt) throw Errors.conflict('ALREADY_SUSPENDED');
    const now = new Date();
    const live = await this.prisma.listing.findMany({ where: { ownerId: id, status: { in: ['published', 'pending'] } }, select: { id: true } });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { suspendedAt: now, suspendReason: b.reason } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await tx.listing.updateMany({ where: { id: { in: live.map((x) => x.id) } }, data: { status: 'removed', removedReason: 'account_suspended' } });
      // Usta/kaptan olarak da listeden kalkar, yeni ödeme alamaz; açık talepleri iptal olur.
      await retireServices(tx, id, { anonymize: false });
    });
    await this.resolveReports(live.map((x) => x.id), 'actioned', u.id);
    await this.audit.log(u.id, 'audit.userSuspended', { name: target.name ?? '—', listings: String(live.length) }, 'user', id);
    return { suspended: true, removedListings: live.length };
  }

  @Auth(STAFF)
  @Post('users/:id/unsuspend')
  @HttpCode(200)
  async unsuspend(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) throw Errors.notFound();
    if (!target.suspendedAt) throw Errors.conflict('NOT_SUSPENDED');
    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { suspendedAt: null, suspendReason: null } });
      await restoreServices(tx, id);
      // Askı yüzünden kaldırılan ilanlar doğrudan yayına dönmez; ekip yeniden bakar.
      return (await tx.listing.updateMany({ where: { ownerId: id, status: 'removed', removedReason: 'account_suspended' }, data: { status: 'pending', removedReason: null } })).count;
    });
    await this.audit.log(u.id, 'audit.userUnsuspended', { name: target.name ?? '—' }, 'user', id);
    return { suspended: false, restoredListings: restored };
  }

  private async resolveReports(listingIds: string[], status: 'actioned' | 'dismissed', by: string) {
    if (!listingIds.length) return 0;
    const r = await this.prisma.listingReport.updateMany({
      where: { listingId: { in: listingIds }, status: 'open' },
      data: { status, resolvedAt: new Date(), resolvedBy: by },
    });
    return r.count;
  }
}
