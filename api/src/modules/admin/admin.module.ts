import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { maskPhone } from '@tms/shared';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { DevSmsSender } from '../../adapters/sms';
import { env } from '../../config/env';
import { BoatsModule } from '../boats/boats.module';
import { I18N_PREFIX, LogbookService, dateOnly } from '../boats/logbook.service';
import { NotificationsService } from '../notifications/notifications.module';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
const decisionBody = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('reject'), reason: z.enum(['blurry', 'mismatch', 'rules']) }),
]);
const reportBody = z.object({ score: z.number().int().min(0).max(100) });
const alreadyDecided = () => new AppError('ALREADY_DECIDED', 'errors.already_decided', 409);

@Controller('admin')
class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly logbook: LogbookService,
    private readonly sms: DevSmsSender,
  ) {}

  @Auth(STAFF)
  @Get('overview')
  async overview() {
    const [activeListings, pendingListings, pendingVerifications, openBroker, pendingReports, users7d] = await Promise.all([
      this.prisma.listing.count({ where: { status: 'published' } }),
      this.prisma.listing.count({ where: { status: 'pending' } }),
      this.prisma.verificationRequest.count({ where: { status: 'pending' } }),
      this.prisma.brokerCase.count({ where: { step: { lt: 4 } } }),
      this.prisma.expertiseBooking.count({ where: { reportStatus: 'pending' } }),
      this.prisma.user.count({ where: { createdAt: { gt: new Date(Date.now() - 7 * 864e5) }, deletedAt: null } }),
    ]);
    return { activeListings, pendingListings, pendingVerifications, openBroker, pendingReports, users7d };
  }

  @Auth(STAFF)
  @Get('queue')
  async queue(@Query('kind') kind: string) {
    if (kind === 'verification') {
      const rows = await this.prisma.verificationRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
      const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
      return rows.map((r) => ({ ...r, userName: users.find((x) => x.id === r.userId)?.name ?? null }));
    }
    const rows = await this.prisma.listing.findMany({ where: { status: 'pending' }, orderBy: { updatedAt: 'asc' }, include: { owner: { select: { name: true } }, photos: true } });
    return rows.map((l) => ({
      id: l.id, title: `${l.brand} ${l.model}`, year: l.year, price: l.price, currency: l.currency, ownerName: l.owner.name,
      photoCount: l.photos.length, photos: [...l.photos].sort((a, b) => a.order - b.order).map((p) => `/media/${p.fileId}`), updatedAt: l.updatedAt,
    }));
  }

  @Auth(STAFF)
  @Post('listings/:id/decision')
  @HttpCode(200)
  async decideListing(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(decisionBody)) b: z.infer<typeof decisionBody>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw Errors.notFound();
    // Yarış güvenliği: yalnızca hâlâ bekleyen ilan için karar yazılır.
    const approve = b.decision === 'approve';
    const r = await this.prisma.listing.updateMany({
      where: { id, status: 'pending' },
      data: approve ? { status: 'published', publishedAt: new Date(), rejectReason: null } : { status: 'rejected', rejectReason: b.reason },
    });
    if (!r.count) throw alreadyDecided();
    const title = `${l.brand} ${l.model}`;
    await this.notifications.push(l.ownerId, approve ? 'notif.listingApproved' : 'notif.listingRejected', { title, listingId: id, ...(approve ? {} : { reason: b.reason }) });
    await this.audit.log(u.id, approve ? 'audit.listingApproved' : 'audit.listingRejected', { title }, 'listing', id);
    return { id, status: approve ? 'published' : 'rejected' };
  }

  /** Belge onayı etkileri: kimlik → seviye 2, mesleki belge → seviye 3, ruhsat → ilana "sahiplik" rozeti. */
  @Auth(STAFF)
  @Post('verifications/:id/decision')
  @HttpCode(200)
  async decideVerification(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(decisionBody)) b: z.infer<typeof decisionBody>) {
    const v = await this.prisma.verificationRequest.findUnique({ where: { id } });
    if (!v) throw Errors.notFound();
    const approve = b.decision === 'approve';
    const r = await this.prisma.verificationRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status: approve ? 'approved' : 'rejected', rejectReason: approve ? null : b.reason, reviewedById: u.id, decidedAt: new Date() },
    });
    if (!r.count) throw alreadyDecided();
    if (approve) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: v.userId } });
      if (v.kind === 'identity') await this.prisma.user.update({ where: { id: v.userId }, data: { verifyLevel: Math.max(2, user.verifyLevel) } });
      else if (v.kind === 'ruhsat' && v.listingId) {
        const l = await this.prisma.listing.findUnique({ where: { id: v.listingId } });
        if (l && !l.badges.includes('sahiplik')) await this.prisma.listing.update({ where: { id: l.id }, data: { badges: [...l.badges, 'sahiplik'] } });
      } else if (v.kind !== 'ruhsat') await this.prisma.user.update({ where: { id: v.userId }, data: { verifyLevel: 3 } });
    }
    await this.notifications.push(v.userId, approve ? 'notif.docApproved' : 'notif.docRejected', { kind: v.kind, ...(approve ? {} : { reason: b.reason }) });
    await this.audit.log(u.id, approve ? 'audit.docApproved' : 'audit.docRejected', { title: v.kind }, 'verification', id);
    return { id, status: approve ? 'approved' : 'rejected' };
  }

  @Auth(STAFF)
  @Get('broker')
  async brokerCases() {
    const rows = await this.prisma.brokerCase.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    return rows.map((c) => ({ ...c, userName: users.find((x) => x.id === c.userId)?.name ?? null }));
  }

  @Auth(STAFF)
  @Get('expertise')
  async expertiseBookings() {
    const rows = await this.prisma.expertiseBooking.findMany({ orderBy: { date: 'desc' }, take: 200 });
    const pkgs = await this.prisma.expertisePackage.findMany();
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    return rows.map((b) => ({
      id: b.id, date: dateOnly(b.date), slot: b.slot, reportStatus: b.reportStatus, score: b.score, listingId: b.listingId,
      packageName: pkgs.find((p) => p.id === b.packageId)?.name ?? null, userName: users.find((x) => x.id === b.userId)?.name ?? null,
    }));
  }

  @Auth(STAFF)
  @Get('users')
  async users() {
    const rows = await this.prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 200 });
    // Kişisel veriler maskeli; tam görüntüleme bu turda yok.
    return rows.map((x) => ({
      id: x.id, name: x.name, roles: x.roles, verifyLevel: x.verifyLevel, createdAt: x.createdAt,
      phone: x.phone ? maskPhone(x.phone) : null,
      nationalId: x.nationalIdLast2 ? `•••••••••${x.nationalIdLast2}` : null,
    }));
  }

  @Auth(STAFF)
  @Get('audit')
  audit_() {
    return this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 100 });
  }

  @Auth(STAFF)
  @Post('broker/:id/advance')
  @HttpCode(200)
  async advanceBroker(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const c = await this.prisma.brokerCase.findUnique({ where: { id } });
    if (!c) throw Errors.notFound();
    const r = await this.prisma.brokerCase.updateMany({ where: { id, step: c.step, AND: { step: { lt: 4 } } }, data: { step: c.step + 1 } });
    if (!r.count) throw new AppError('BROKER_DONE', 'errors.broker_done', 409);
    await this.notifications.push(c.userId, 'notif.brokerAdvanced', { boat: c.boatName, step: String(c.step + 1) });
    await this.audit.log(u.id, 'audit.brokerAdvanced', { boat: c.boatName }, 'broker', id);
    return { id, step: c.step + 1 };
  }

  /** Rapor tamamlanınca: ilana "ekspertizli" rozeti ve ilana bağlı teknenin karnesine doğrulanmış kayıt. */
  @Auth(STAFF)
  @Post('expertise/:id/report')
  @HttpCode(200)
  async report(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(reportBody)) b: z.infer<typeof reportBody>) {
    const r = await this.prisma.expertiseBooking.updateMany({ where: { id, reportStatus: 'pending' }, data: { reportStatus: 'done', score: b.score } });
    if (!r.count) throw alreadyDecided();
    const bk = await this.prisma.expertiseBooking.findUniqueOrThrow({ where: { id } });
    if (bk.listingId) {
      const l = await this.prisma.listing.findUnique({ where: { id: bk.listingId } });
      if (l) {
        if (!l.badges.includes('ekspertizli')) await this.prisma.listing.update({ where: { id: l.id }, data: { badges: [...l.badges, 'ekspertizli'] } });
        if (l.boatId) await this.logbook.addVerified(l.boatId, { kind: 'ekspertiz', date: dateOnly(bk.date), title: `${I18N_PREFIX}logbook.expertiseReport`, byName: `${I18N_PREFIX}logbook.platformSurveyor`, sourceRef: id });
      }
    }
    await this.notifications.push(bk.userId, 'notif.reportReady', { score: String(b.score) });
    await this.audit.log(u.id, 'audit.reportCompleted', { score: String(b.score) }, 'expertise', id);
    return { id, score: b.score };
  }

  /** Geliştirme: SMS sağlayıcı bağlanana kadar giriş kodları buradan okunur. Üretimde yoktur. */
  @Auth({ roles: ['admin'] })
  @Get('dev/otp-inbox')
  otpInbox() {
    if (env().NODE_ENV === 'production') throw Errors.notFound();
    return this.sms.inbox();
  }
}

@Module({ imports: [BoatsModule], controllers: [AdminController] })
export class AdminModule {}
