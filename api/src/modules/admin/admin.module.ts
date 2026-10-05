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
import { nextExpiry } from '../listings/expiry';
import { photoDuplicates } from '../listings/duplicates';
import { ListingsModule } from '../listings/listings.module';
import { ListingsService } from '../listings/listings.service';
import { ListingTexts } from '../listings/listing-writer.service';
import { reportError } from '../../adapters/error-report';
import { ModerationController } from './moderation.controller';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
const decisionBody = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({ decision: z.literal('reject'), reason: z.enum(['blurry', 'mismatch', 'rules']) }),
]);
/**
 * İlan kararı, moderatörün gördüğü sürüme bağlanır (`version` = kuyruktaki `updatedAt`). Satıcı o arada ilanı
 * değiştirdiyse karar yazılmaz; moderatör yeni hâlini görmeden yayına çıkamaz.
 */
const listingDecisionBody = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve'), version: z.string().max(40).optional() }),
  z.object({ decision: z.literal('reject'), reason: z.enum(['blurry', 'mismatch', 'rules']), version: z.string().max(40).optional() }),
]);
const listingChanged = () => new AppError('LISTING_CHANGED', 'errors.listing_changed', 409);
const versionRequired = () => new AppError('VERSION_REQUIRED', 'errors.version_required', 400);
const reportBody = z.object({ score: z.number().int().min(0).max(100) });
/** Bu puanın altındaki ekspertiz raporu ilana "ekspertizli" rozeti vermez. */
export const EXPERTISE_BADGE_MIN_SCORE = 60;
const alreadyDecided = () => new AppError('ALREADY_DECIDED', 'errors.already_decided', 409);
/** Ekip üyesi kendi ilanına ya da belgesine karar veremez (çıkar çatışması). */
const selfDecision = () => new AppError('SELF_DECISION', 'errors.self_decision', 403);

@Controller('admin')
class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly logbook: LogbookService,
    private readonly sms: DevSmsSender,
    private readonly listings: ListingsService,
    private readonly texts: ListingTexts,
  ) {}

  @Auth(STAFF)
  @Get('overview')
  async overview() {
    const [activeListings, pendingListings, pendingVerifications, openBroker, pendingReports, users7d, openListingReports] = await Promise.all([
      this.prisma.listing.count({ where: { status: 'published' } }),
      this.prisma.listing.count({ where: { status: 'pending' } }),
      this.prisma.verificationRequest.count({ where: { status: 'pending' } }),
      this.prisma.brokerCase.count({ where: { step: { lt: 4 } } }),
      this.prisma.expertiseBooking.count({ where: { reportStatus: 'pending' } }),
      this.prisma.user.count({ where: { createdAt: { gt: new Date(Date.now() - 7 * 864e5) }, deletedAt: null } }),
      this.prisma.listingReport.count({ where: { status: 'open' } }),
    ]);
    return { activeListings, pendingListings, pendingVerifications, openBroker, pendingReports, users7d, openListingReports };
  }

  @Auth(STAFF)
  @Get('queue')
  async queue(@Query('kind') kind: string) {
    if (kind === 'verification') {
      const rows = await this.prisma.verificationRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
      const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
      return rows.map((r) => ({ ...r, userName: users.find((x) => x.id === r.userId)?.name ?? null }));
    }
    const rows = await this.prisma.listing.findMany({
      where: { status: 'pending' }, orderBy: { updatedAt: 'asc' },
      include: { owner: { select: { name: true, verifyLevel: true } }, photos: true },
    });
    // Yeniden gönderilen ilanda önceki red gerekçesi (ilanda gönderimde silinir; kayıt denetim günlüğünde kalır).
    const rejections = await this.prisma.auditLog.findMany({
      where: { action: 'audit.listingRejected', targetType: 'listing', targetId: { in: rows.map((l) => l.id) } }, orderBy: { at: 'desc' },
    });
    const dups = await photoDuplicates(this.prisma, rows.map((l) => l.id));
    const previousReason = (id: string) => (rejections.find((x) => x.targetId === id)?.params as { reason?: string } | null)?.reason ?? null;
    // Moderatör ilanın yayına çıkacak her şeyini görür: açıklama, konum, özellikler ve yeni alanlar dahil.
    return rows.map((l) => ({
      previousRejectReason: previousReason(l.id),
      /** Aynı fotoğrafın kullanıldığı diğer ilanlar (başka satıcıda: çalıntı şüphesi; aynı satıcıda: mükerrer ilan). */
      photoDuplicates: dups.get(l.id) ?? [],
      id: l.id, title: `${l.brand} ${l.model}`, year: l.year, price: l.price, currency: l.currency, ownerName: l.owner.name,
      ownerVerifyLevel: l.owner.verifyLevel,
      photoCount: l.photos.length, photos: [...l.photos].sort((a, b) => a.order - b.order).map((p) => `/media/${p.fileId}`), updatedAt: l.updatedAt,
      version: l.updatedAt.toISOString(),
      brand: l.brand, model: l.model, lengthM: l.lengthM, type: l.type, location: l.location, cabins: l.cabins, engine: l.engine,
      engineHours: l.engineHours, flag: l.flag, tradeIn: l.tradeIn, negotiable: l.negotiable, equipment: l.equipment,
      description: l.description, badges: l.badges,
    }));
  }

  @Auth(STAFF)
  @Post('listings/:id/decision')
  @HttpCode(200)
  async decideListing(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(listingDecisionBody)) b: z.infer<typeof listingDecisionBody>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw selfDecision();
    if (l.status !== 'pending') throw alreadyDecided();
    if (!b.version) throw versionRequired();
    if (b.version !== l.updatedAt.toISOString()) throw listingChanged();
    // Yarış güvenliği: yalnızca hâlâ bekleyen ve moderatörün gördüğü sürümdeki ilan için karar yazılır.
    const approve = b.decision === 'approve';
    const r = await this.prisma.listing.updateMany({
      where: { id, status: 'pending', updatedAt: l.updatedAt },
      data: approve ? { status: 'published', publishedAt: new Date(), expiresAt: nextExpiry(), expiryWarnedAt: null, rejectReason: null } : { status: 'rejected', rejectReason: b.reason },
    });
    if (!r.count) {
      // Başka moderatör aynı anda karar verdiyse "zaten karar verildi", satıcı değiştirdiyse "ilan değişti".
      const now = await this.prisma.listing.findUnique({ where: { id }, select: { status: true } });
      throw now?.status === 'pending' ? listingChanged() : alreadyDecided();
    }
    const title = `${l.brand} ${l.model}`;
    await this.notifications.push(l.ownerId, approve ? 'notif.listingApproved' : 'notif.listingRejected', { title, listingId: id, ...(approve ? {} : { reason: b.reason }) });
    // Kayıtlı aramalara yeni ilan bildirimi yanıtı bekletmez (çok sayıda aramada da karar anında döner).
    if (approve) this.listings.notifySearchMatches(id).catch((e) => void reportError(e, { job: 'search-match' }));
    // Yabancı alıcılar için İngilizce açıklama (anahtar yoksa yapılmaz; hata ilanı etkilemez).
    if (approve) this.texts.translateListing(id).catch((e) => void reportError(e, { job: 'translate' }));
    // Kayıt hangi sürüme ve fiyata karar verildiğini de tutar (sonradan "onaylanan buydu" denetimi için).
    await this.audit.log(u.id, approve ? 'audit.listingApproved' : 'audit.listingRejected',
      { title, version: b.version, price: `${l.price} ${l.currency}`, ...(approve ? {} : { reason: b.reason ?? '' }) }, 'listing', id);
    return { id, status: approve ? 'published' : 'rejected' };
  }

  /** Belge onayı etkileri: kimlik → seviye 2, mesleki belge → seviye 3, ruhsat → ilana "sahiplik" rozeti (+ motor seri no fotoğrafı da varsa "belge"). */
  @Auth(STAFF)
  @Post('verifications/:id/decision')
  @HttpCode(200)
  async decideVerification(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(decisionBody)) b: z.infer<typeof decisionBody>) {
    const v = await this.prisma.verificationRequest.findUnique({ where: { id } });
    if (!v) throw Errors.notFound();
    if (v.userId === u.id) throw selfDecision();
    const approve = b.decision === 'approve';
    // Karar ve etkisi (seviye/rozet) tek işlemde: biri yazılıp diğeri yarım kalmaz.
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.verificationRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status: approve ? 'approved' : 'rejected', rejectReason: approve ? null : b.reason, reviewedById: u.id, decidedAt: new Date() },
      });
      if (!r.count) throw alreadyDecided();
      if (!approve) return;
      const user = await tx.user.findUniqueOrThrow({ where: { id: v.userId } });
      if (v.kind === 'identity') await tx.user.update({ where: { id: v.userId }, data: { verifyLevel: Math.max(2, user.verifyLevel) } });
      else if (v.kind === 'ruhsat' && v.listingId) {
        const l = await tx.listing.findUnique({ where: { id: v.listingId } });
        // Ruhsat + motor seri numarası fotoğrafı birlikte onaylandıysa belgeler eşleşmiş sayılır.
        const granted = v.fileIds.length >= 2 ? ['sahiplik', 'belge'] : ['sahiplik'];
        const badges = l ? [...l.badges, ...granted.filter((b) => !l.badges.includes(b))] : [];
        if (l && badges.length !== l.badges.length) await tx.listing.update({ where: { id: l.id }, data: { badges } });
      } else if (v.kind !== 'ruhsat') {
        await tx.user.update({ where: { id: v.userId }, data: { verifyLevel: 3 } });
        // Usta/kaptan belgesi onaylanınca açılmış hizmet profili listelerde görünür.
        if (v.kind === 'usta' || v.kind === 'kaptan') await tx.providerProfile.updateMany({ where: { userId: v.userId, kind: v.kind, status: 'pending' }, data: { status: 'active' } });
      }
    });
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
      suspendedAt: x.suspendedAt, suspendReason: x.suspendReason, reregistered: !!x.reregisteredFrom,
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
      // Rozet ve karne kaydı yalnızca ilan sahibinin yaptırdığı ekspertizden: alıcının raporu kendisinindir.
      // Rozet ayrıca düşük puanlı raporda verilmez ("ekspertizli" bir güven işaretidir).
      if (l && bk.userId === l.ownerId) {
        if (b.score >= EXPERTISE_BADGE_MIN_SCORE && !l.badges.includes('ekspertizli')) await this.prisma.listing.update({ where: { id: l.id }, data: { badges: [...l.badges, 'ekspertizli'] } });
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

@Module({ imports: [BoatsModule, ListingsModule], controllers: [AdminController, ModerationController] })
export class AdminModule {}
