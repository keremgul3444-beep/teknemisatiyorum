import { Body, Controller, Get, HttpCode, Injectable, Logger, Module, Param, Post, Put, Query, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { z } from 'zod';
import { USTA_CATEGORIES } from '@tms/shared';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { NotificationsService } from '../notifications/notifications.module';
import { BoatsModule } from '../boats/boats.module';
import { LogbookService, dateOnly, parseDateOnly, I18N_PREFIX } from '../boats/logbook.service';
import { ListingsModule } from '../listings/listings.module';
import { FxService } from '../listings/fx.service';
import { PromotionsModule } from '../promotions/promotions.module';
import { EscrowService, JOB_AUTO_RELEASE_DAYS } from '../promotions/escrow.service';
import { env } from '../../config/env';
import { payBody, assertAccepted } from '../../common/legal';
import { reportError } from '../../adapters/error-report';
import { bookingView, captainTotal, jobView, providerView } from './views';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
/** Para kararları (iade, aktarım) yalnızca yöneticide. */
const ADMIN = { roles: ['admin'] as ('moderator' | 'admin')[] };
/** Kullanıcı metni sistem çeviri anahtarı gibi görünemez (karneye düşen başlık). */
const userText = (min: number, max: number) => z.string().trim().min(min).max(max).refine((s) => !s.startsWith(I18N_PREFIX), 'reserved');
const kindParam = z.enum(['usta', 'kaptan']);
const profileBody = z.object({
  displayName: userText(2, 60),
  categories: z.array(z.enum(USTA_CATEGORIES)).max(USTA_CATEGORIES.length).default([]),
  region: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(1000).default(''),
  priceNote: z.string().trim().max(120).default(''),
  yearsExp: z.number().int().min(0).max(60).default(0),
  languages: z.array(z.string().trim().min(2).max(20)).max(6).default([]),
  areas: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
  dayRateEur: z.number().int().min(1).max(100000).optional(),
  weekRateEur: z.number().int().min(1).max(700000).optional(),
});
const listQuery = z.object({ kind: kindParam, category: z.enum(USTA_CATEGORIES).optional(), region: z.string().max(40).optional() });
const jobBody = z.object({
  category: z.enum(USTA_CATEGORIES), title: userText(3, 80), description: z.string().trim().min(10).max(2000),
  boatId: z.string().optional(), region: z.string().trim().max(40).default(''),
});
const quoteBody = z.object({ priceTry: z.number().int().min(100).max(10_000_000), days: z.number().int().min(1).max(365), note: z.string().trim().max(500).default('') });
const acceptBody = z.object({ quoteId: z.string().min(1) });
const reviewBody = z.object({ stars: z.number().int().min(1).max(5), text: z.string().trim().max(500).default('') });
const bookingBody = z.object({ providerId: z.string().min(1), start: z.iso.date(), days: z.number().int().min(1).max(60) });
const disputeBody = z.object({ note: z.string().trim().min(5).max(500) });

/** Aynı anda açık en fazla bu kadar iş talebi. */
export const MAX_OPEN_JOBS = 10;
const quoteInclude = { quotes: { include: { provider: true }, orderBy: { priceTry: 'asc' as const } } };
const notAllowed = (code: string) => Errors.conflict(code);

// ——— Hizmet veren profilleri ———

@Controller()
class ProvidersController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * Profilimi aç/güncelle (usta ya da kaptan). Kimliği doğrulanmış (seviye 2) kişi açar; ilgili belgesi onaylandıysa
   * profil hemen listelerde görünür, değilse belge onayına kadar bekler (`pending`).
   */
  @Auth({ level: 2 })
  @Put('me/provider/:kind')
  async upsert(@CurrentUser() u: AuthUser, @Param('kind', new ZodPipe(kindParam)) kind: 'usta' | 'kaptan', @Body(new ZodPipe(profileBody)) b: z.infer<typeof profileBody>) {
    if (kind === 'usta' && !b.categories.length) throw Errors.bad('CATEGORY_REQUIRED');
    if (kind === 'kaptan' && !b.dayRateEur) throw Errors.bad('RATE_REQUIRED');
    const approved = await this.prisma.verificationRequest.count({ where: { userId: u.id, kind, status: 'approved' } });
    const data = { ...b, categories: kind === 'usta' ? b.categories : [], dayRateEur: kind === 'kaptan' ? b.dayRateEur : null, weekRateEur: kind === 'kaptan' ? b.weekRateEur ?? null : null };
    const existing = await this.prisma.providerProfile.findUnique({ where: { userId_kind: { userId: u.id, kind } } });
    if (existing?.status === 'suspended') throw Errors.forbidden();
    const p = await this.prisma.providerProfile.upsert({
      where: { userId_kind: { userId: u.id, kind } },
      create: { ...data, userId: u.id, kind, status: approved ? 'active' : 'pending' },
      update: { ...data, ...(approved ? { status: 'active' } : {}) },
    });
    if (!existing) await this.audit.log(u.id, 'audit.providerCreated', { kind }, 'provider', p.id);
    return { ...providerView(p), status: p.status };
  }

  @Auth()
  @Get('me/providers')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.providerProfile.findMany({ where: { userId: u.id } });
    return rows.map((p) => ({ ...providerView(p), status: p.status }));
  }

  /** Herkese açık liste: yalnızca belgesi onaylı (aktif) hizmet verenler, puana göre. */
  @Public()
  @Get('providers')
  async list(@Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    const rows = await this.prisma.providerProfile.findMany({
      where: { kind: q.kind, status: 'active', ...(q.category ? { categories: { has: q.category } } : {}), ...(q.region ? { region: { equals: q.region, mode: 'insensitive' } } : {}) },
      orderBy: [{ ratingCount: 'desc' }, { createdAt: 'asc' }], take: 100,
    });
    return rows.map((p) => providerView(p)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  @Public()
  @Get('providers/:id')
  async one(@Param('id') id: string) {
    const p = await this.prisma.providerProfile.findUnique({ where: { id } });
    if (!p || p.status !== 'active') throw Errors.notFound();
    const reviews = await this.prisma.review.findMany({ where: { providerId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
    return providerView(p, reviews);
  }
}

// ——— Usta işleri ———

@Controller()
class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly escrow: EscrowService,
    private readonly logbook: LogbookService,
  ) {}

  @Auth({ level: 1 })
  @Post('jobs')
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(jobBody)) b: z.infer<typeof jobBody>) {
    if (b.boatId && !(await this.prisma.boat.count({ where: { id: b.boatId, ownerId: u.id } }))) throw Errors.notFound();
    if ((await this.prisma.job.count({ where: { ownerId: u.id, status: { in: ['open', 'accepted'] } } })) >= MAX_OPEN_JOBS) throw notAllowed('TOO_MANY_JOBS');
    const j = await this.prisma.job.create({ data: { ...b, ownerId: u.id }, include: quoteInclude });
    // Bu alandaki aktif ustalara haber (en fazla 50).
    const ustas = await this.prisma.providerProfile.findMany({ where: { kind: 'usta', status: 'active', categories: { has: b.category }, userId: { not: u.id } }, take: 50 });
    await Promise.all(ustas.map((p) => this.notifications.push(p.userId, 'notif.newJob', { jobId: j.id, title: j.title })));
    return jobView(j, { userId: u.id });
  }

  @Auth()
  @Get('me/jobs')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.job.findMany({ where: { ownerId: u.id }, include: quoteInclude, orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = rows.map((j) => j.id);
    const [pays, reviews] = await Promise.all([
      this.prisma.servicePayment.findMany({ where: { subjectKind: 'job', subjectId: { in: ids }, status: { in: ['held', 'released', 'refunded'] } } }),
      this.prisma.review.findMany({ where: { subjectKind: 'job', subjectId: { in: ids } }, select: { subjectId: true } }),
    ]);
    return rows.map((j) => jobView(j, { userId: u.id }, pays.find((p) => p.subjectId === j.id), reviews.some((r) => r.subjectId === j.id)));
  }

  /** Ustanın gelen kutusu: alanındaki açık işler (kendi işi hariç) ve teklif verdiği işler. */
  @Auth()
  @Get('provider/jobs')
  async inbox(@CurrentUser() u: AuthUser) {
    const me = await this.prisma.providerProfile.findUnique({ where: { userId_kind: { userId: u.id, kind: 'usta' } } });
    if (!me || me.status !== 'active') return { open: [], quoted: [] };
    const [open, quoted] = await Promise.all([
      this.prisma.job.findMany({ where: { status: 'open', category: { in: me.categories }, ownerId: { not: u.id }, quotes: { none: { providerId: me.id } } }, include: quoteInclude, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.job.findMany({ where: { quotes: { some: { providerId: me.id } } }, include: quoteInclude, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const v = (j: (typeof open)[number]) => jobView(j, { userId: u.id, providerId: me.id });
    return { open: open.map(v), quoted: quoted.map(v) };
  }

  @Auth()
  @Get('jobs/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const j = await this.prisma.job.findUnique({ where: { id }, include: quoteInclude });
    if (!j) throw Errors.notFound();
    if (j.ownerId === u.id) {
      const [pay, reviewed] = await Promise.all([
        this.prisma.servicePayment.findFirst({ where: { subjectKind: 'job', subjectId: id, status: { in: ['held', 'released', 'refunded'] } } }),
        this.prisma.review.count({ where: { subjectKind: 'job', subjectId: id } }),
      ]);
      return jobView(j, { userId: u.id }, pay, reviewed > 0);
    }
    const me = await this.prisma.providerProfile.findUnique({ where: { userId_kind: { userId: u.id, kind: 'usta' } } });
    const quoted = !!me && j.quotes.some((q) => q.providerId === me.id);
    const canQuote = !!me && me.status === 'active' && j.status === 'open' && me.categories.includes(j.category);
    if (!quoted && !canQuote) throw Errors.notFound();
    return jobView(j, { userId: u.id, providerId: me!.id });
  }

  /** Teklif ver ya da açık işteki teklifini güncelle (alanı tutan aktif usta; kendi işine teklif yok). */
  @Auth({ level: 2 })
  @Post('jobs/:id/quotes')
  async quote(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(quoteBody)) b: z.infer<typeof quoteBody>) {
    const j = await this.prisma.job.findUnique({ where: { id } });
    const me = await this.prisma.providerProfile.findUnique({ where: { userId_kind: { userId: u.id, kind: 'usta' } } });
    if (!j || !me || me.status !== 'active' || !me.categories.includes(j.category)) throw Errors.notFound();
    if (j.ownerId === u.id) throw Errors.bad('OWN_JOB');
    if (j.status !== 'open') throw notAllowed('JOB_CLOSED');
    const fresh = !(await this.prisma.quote.count({ where: { jobId: id, providerId: me.id } }));
    const q = await this.prisma.quote.upsert({ where: { jobId_providerId: { jobId: id, providerId: me.id } }, create: { ...b, jobId: id, providerId: me.id }, update: b });
    if (fresh) await this.notifications.push(j.ownerId, 'notif.newQuote', { jobId: id, title: j.title });
    return { id: q.id, priceTry: q.priceTry, days: q.days, note: q.note };
  }

  @Auth({ level: 1 })
  @Post('jobs/:id/accept')
  @HttpCode(200)
  async accept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(acceptBody)) b: z.infer<typeof acceptBody>) {
    const j = await this.own(id, u.id);
    const q = j.quotes.find((x) => x.id === b.quoteId);
    if (!q) throw Errors.notFound();
    const r = await this.prisma.job.updateMany({ where: { id, status: 'open' }, data: { status: 'accepted', acceptedQuoteId: q.id } });
    if (!r.count) throw notAllowed('JOB_CLOSED');
    await this.notifications.push(q.provider.userId, 'notif.quoteAccepted', { jobId: id, title: j.title });
    return { id, status: 'accepted', acceptedQuoteId: q.id };
  }

  /** Kabul edilen teklifi öde: para emanette bekler, iş bitince ustaya geçer. */
  @Auth({ level: 1 })
  @Post('jobs/:id/pay')
  @HttpCode(200)
  async pay(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(payBody)) b: z.infer<typeof payBody>) {
    assertAccepted(b.accept);
    const j = await this.own(id, u.id);
    const q = j.quotes.find((x) => x.id === j.acceptedQuoteId);
    if (j.status === 'paid' || j.status === 'done') throw new AppError('ALREADY_PAID', 'errors.already_paid', 409);
    if (j.status !== 'accepted' || !q) throw notAllowed('JOB_NOT_ACCEPTED');
    return this.escrow.checkout({ payerId: u.id, providerId: q.providerId, subjectKind: 'job', subjectId: id, amountKurus: q.priceTry * 100 });
  }

  /** İş bitti: emanetteki para ustaya geçer, teknenin karnesine doğrulanmış kayıt düşer. */
  @Auth({ level: 1 })
  @Post('jobs/:id/complete')
  @HttpCode(200)
  async complete(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const j = await this.own(id, u.id);
    if (j.status !== 'paid') throw notAllowed('JOB_NOT_PAID');
    const p = await this.escrow.held('job', id);
    if (!p) throw notAllowed('PAYMENT_NOT_HELD');
    await this.escrow.release(p, u.id);
    await finishJob(this.prisma, this.logbook, id);
    return { id, status: 'done' };
  }

  /** Usta: "işi bitirdim". Sahibi süre içinde onaylamaz ya da sorun bildirmezse ödeme kendiliğinden aktarılır. */
  @Auth()
  @Post('jobs/:id/delivered')
  @HttpCode(200)
  async delivered(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const j = await this.prisma.job.findUnique({ where: { id }, include: quoteInclude });
    const q = j?.quotes.find((x) => x.id === j.acceptedQuoteId);
    if (!j || !q || q.provider.userId !== u.id) throw Errors.notFound();
    if (j.status !== 'paid') throw notAllowed('JOB_NOT_PAID');
    if (j.deliveredAt) throw notAllowed('ALREADY_DELIVERED');
    const p = await this.escrow.held('job', id);
    if (!p) throw notAllowed('PAYMENT_NOT_HELD');
    await this.prisma.job.update({ where: { id }, data: { deliveredAt: new Date() } });
    if (!p.disputedAt) await this.escrow.startAutoRelease(p, JOB_AUTO_RELEASE_DAYS);
    await this.notifications.push(j.ownerId, 'notif.jobDelivered', { jobId: id, title: j.title, days: String(JOB_AUTO_RELEASE_DAYS) });
    return { id, deliveredAt: new Date(), autoReleaseDays: JOB_AUTO_RELEASE_DAYS };
  }

  /** Sahibi: sorun bildir. Otomatik aktarım durur; ekip iade ya da aktarma kararı verir. */
  @Auth({ level: 1 })
  @Post('jobs/:id/dispute')
  @HttpCode(200)
  async dispute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(disputeBody)) b: z.infer<typeof disputeBody>) {
    const j = await this.own(id, u.id);
    if (j.status !== 'paid') throw notAllowed('JOB_NOT_PAID');
    const p = await this.escrow.held('job', id);
    if (!p) throw notAllowed('PAYMENT_NOT_HELD');
    await this.escrow.dispute(p, b.note);
    return { id, disputed: true };
  }

  @Auth({ level: 1 })
  @Post('jobs/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.own(id, u.id);
    const r = await this.prisma.job.updateMany({ where: { id, status: { in: ['open', 'accepted'] } }, data: { status: 'cancelled' } });
    if (!r.count) throw notAllowed('JOB_CLOSED');
    return { id, status: 'cancelled' };
  }

  @Auth({ level: 1 })
  @Post('jobs/:id/review')
  async review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(reviewBody)) b: z.infer<typeof reviewBody>) {
    const j = await this.own(id, u.id);
    if (j.status !== 'done') throw notAllowed('JOB_NOT_DONE');
    const q = j.quotes.find((x) => x.id === j.acceptedQuoteId)!;
    return addReview(this.prisma, { providerId: q.providerId, authorId: u.id, subjectKind: 'job', subjectId: id, ...b });
  }

  private async own(id: string, userId: string) {
    const j = await this.prisma.job.findUnique({ where: { id }, include: quoteInclude });
    if (!j || j.ownerId !== userId) throw Errors.notFound();
    return j;
  }
}

/** İş bitti: durum, tamamlanma anı ve teknenin karnesine doğrulanmış kayıt (bir kez). */
async function finishJob(prisma: PrismaService, logbook: LogbookService, id: string) {
  const j = await prisma.job.findUniqueOrThrow({ where: { id }, include: quoteInclude });
  const r = await prisma.job.updateMany({ where: { id, status: 'paid' }, data: { status: 'done', completedAt: new Date() } });
  const q = j.quotes.find((x) => x.id === j.acceptedQuoteId);
  if (r.count && q && j.boatId) await logbook.addVerified(j.boatId, { kind: 'onarim', date: dateOnly(new Date()), title: j.title, byName: q.provider.displayName, sourceRef: `job:${id}` });
}

async function finishSubject(prisma: PrismaService, logbook: LogbookService, kind: string, id: string) {
  if (kind === 'job') await finishJob(prisma, logbook, id);
  else await prisma.captainBooking.updateMany({ where: { id, status: 'paid' }, data: { status: 'done', completedAt: new Date() } });
}

/** Saatlik: süresi dolmuş, itirazsız emanetleri hizmet verene aktarır; ödeyene haber verir (testte kapalı). */
@Injectable()
export class EscrowSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Escrow');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly logbook: LogbookService,
    private readonly notifications: NotificationsService,
  ) {}

  async sweep(now = new Date()) {
    const due = await this.escrow.dueForRelease(now);
    for (const p of due) {
      await this.escrow.release(p, null);
      await finishSubject(this.prisma, this.logbook, p.subjectKind, p.subjectId);
      await this.notifications.push(p.payerId, 'notif.autoReleased', { kind: p.subjectKind, id: p.subjectId });
    }
    return due.length;
  }

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const run = () => this.sweep().then((n) => n && this.log.log(`${n} emanet ödeme süre sonunda aktarıldı`)).catch((e) => { this.log.error(`Emanet taraması yapılamadı: ${e}`); void reportError(e, { job: 'escrow-sweep' }); });
    this.timer = setInterval(run, 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}

/** Değerlendirme bir kez yazılır; hizmet verenin puan toplamı aynı işlemde artar. */
async function addReview(prisma: PrismaService, r: { providerId: string; authorId: string; subjectKind: 'job' | 'captain'; subjectId: string; stars: number; text: string }) {
  try {
    const [row] = await prisma.$transaction([
      prisma.review.create({ data: r }),
      prisma.providerProfile.update({ where: { id: r.providerId }, data: { ratingSum: { increment: r.stars }, ratingCount: { increment: 1 } } }),
    ]);
    return { id: row.id, stars: row.stars };
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new AppError('ALREADY_REVIEWED', 'errors.already_reviewed', 409);
    throw e;
  }
}

// ——— Kaptan rezervasyonları ———

@Controller()
class BookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly escrow: EscrowService,
    private readonly fx: FxService,
  ) {}

  @Auth({ level: 1 })
  @Post('captain-bookings')
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(bookingBody)) b: z.infer<typeof bookingBody>) {
    const p = await this.prisma.providerProfile.findUnique({ where: { id: b.providerId } });
    if (!p || p.kind !== 'kaptan' || p.status !== 'active') throw Errors.notFound();
    if (p.userId === u.id) throw Errors.bad('OWN_PROFILE');
    const start = parseDateOnly(b.start);
    if (start.getTime() < parseDateOnly(dateOnly(new Date())).getTime()) throw Errors.bad('PAST_DATE');
    const end = new Date(start.getTime() + b.days * 864e5);
    // Ödenmiş başka bir rezervasyonla çakışan tarih alınamaz.
    const busy = await this.prisma.captainBooking.findMany({ where: { providerId: p.id, status: 'paid', start: { lt: end } } });
    if (busy.some((x) => x.start.getTime() + x.days * 864e5 > start.getTime())) throw notAllowed('CAPTAIN_BUSY');
    const row = await this.prisma.captainBooking.create({ data: { userId: u.id, providerId: p.id, start, days: b.days, totalEur: captainTotal(p, b.days) }, include: { provider: true } });
    await this.notifications.push(p.userId, 'notif.bookingRequested', { bookingId: row.id, start: b.start, days: String(b.days) });
    return bookingView(row, u.id);
  }

  @Auth()
  @Get('me/captain-bookings')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.captainBooking.findMany({ where: { userId: u.id }, include: { provider: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    const ids = rows.map((b) => b.id);
    const [reviews, pays] = await Promise.all([
      this.prisma.review.findMany({ where: { subjectKind: 'captain', subjectId: { in: ids } }, select: { subjectId: true } }),
      this.prisma.servicePayment.findMany({ where: { subjectKind: 'captain', subjectId: { in: ids }, status: { in: ['held', 'released', 'refunded'] } } }),
    ]);
    return rows.map((b) => bookingView(b, u.id, reviews.some((r) => r.subjectId === b.id), pays.find((p) => p.subjectId === b.id)));
  }

  /** Kaptanın takvimi: kendisine gelen rezervasyonlar (müşterinin adı yok; iletişim mesajla). */
  @Auth()
  @Get('provider/bookings')
  async inbox(@CurrentUser() u: AuthUser) {
    const me = await this.prisma.providerProfile.findUnique({ where: { userId_kind: { userId: u.id, kind: 'kaptan' } } });
    if (!me) return [];
    const rows = await this.prisma.captainBooking.findMany({ where: { providerId: me.id, status: { not: 'cancelled' } }, include: { provider: true }, orderBy: { start: 'asc' }, take: 100 });
    return rows.map((b) => bookingView(b, u.id));
  }

  /** Öde: avro tutar ödeme anındaki kurla TL'ye çevrilir; para emanette bekler. */
  @Auth({ level: 1 })
  @Post('captain-bookings/:id/pay')
  @HttpCode(200)
  async pay(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(payBody)) body: z.infer<typeof payBody>) {
    assertAccepted(body.accept);
    const b = await this.own(id, u.id);
    if (b.status === 'paid' || b.status === 'done') throw new AppError('ALREADY_PAID', 'errors.already_paid', 409);
    if (b.status !== 'requested') throw notAllowed('BOOKING_CLOSED');
    const rate = (await this.fx.rates()).EUR;
    return this.escrow.checkout({ payerId: u.id, providerId: b.providerId, subjectKind: 'captain', subjectId: id, amountKurus: Math.round(b.totalEur * rate * 100) });
  }

  /** Rezervasyon başladıktan sonra müşteri tamamlar: para kaptana geçer. */
  @Auth({ level: 1 })
  @Post('captain-bookings/:id/complete')
  @HttpCode(200)
  async complete(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const b = await this.own(id, u.id);
    if (b.status !== 'paid') throw notAllowed('BOOKING_NOT_PAID');
    if (b.start.getTime() > Date.now()) throw notAllowed('BOOKING_NOT_STARTED');
    const p = await this.escrow.held('captain', id);
    if (!p) throw notAllowed('PAYMENT_NOT_HELD');
    await this.escrow.release(p, u.id);
    await this.prisma.captainBooking.update({ where: { id }, data: { status: 'done', completedAt: new Date() } });
    return { id, status: 'done' };
  }

  @Auth({ level: 1 })
  @Post('captain-bookings/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.own(id, u.id);
    const r = await this.prisma.captainBooking.updateMany({ where: { id, status: 'requested' }, data: { status: 'cancelled' } });
    if (!r.count) throw notAllowed('BOOKING_CLOSED');
    return { id, status: 'cancelled' };
  }

  /** Müşteri: sorun bildir (ödenmiş rezervasyon). Otomatik aktarım durur, karar ekipte. */
  @Auth({ level: 1 })
  @Post('captain-bookings/:id/dispute')
  @HttpCode(200)
  async dispute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(disputeBody)) b: z.infer<typeof disputeBody>) {
    const bk = await this.own(id, u.id);
    if (bk.status !== 'paid') throw notAllowed('BOOKING_NOT_PAID');
    const p = await this.escrow.held('captain', id);
    if (!p) throw notAllowed('PAYMENT_NOT_HELD');
    await this.escrow.dispute(p, b.note);
    return { id, disputed: true };
  }

  /** Kaptan ödenmemiş talebi geri çevirir. */
  @Auth()
  @Post('captain-bookings/:id/decline')
  @HttpCode(200)
  async decline(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const b = await this.prisma.captainBooking.findUnique({ where: { id }, include: { provider: true } });
    if (!b || b.provider.userId !== u.id) throw Errors.notFound();
    const r = await this.prisma.captainBooking.updateMany({ where: { id, status: 'requested' }, data: { status: 'cancelled' } });
    if (!r.count) throw notAllowed('BOOKING_CLOSED');
    await this.notifications.push(b.userId, 'notif.bookingDeclined', { bookingId: id });
    return { id, status: 'cancelled' };
  }

  @Auth({ level: 1 })
  @Post('captain-bookings/:id/review')
  async review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(reviewBody)) b: z.infer<typeof reviewBody>) {
    const bk = await this.own(id, u.id);
    if (bk.status !== 'done') throw notAllowed('BOOKING_NOT_DONE');
    return addReview(this.prisma, { providerId: bk.providerId, authorId: u.id, subjectKind: 'captain', subjectId: id, ...b });
  }

  private async own(id: string, userId: string) {
    const b = await this.prisma.captainBooking.findUnique({ where: { id } });
    if (!b || b.userId !== userId) throw Errors.notFound();
    return b;
  }
}

// ——— Emanet ödemeler: ödeyenin görünümü ve ekip yönetimi ———

@Controller()
class ServicePaymentsController {
  constructor(private readonly prisma: PrismaService, private readonly escrow: EscrowService, private readonly logbook: LogbookService) {}

  /** Ödeyenin ödemeleri (Profil > Ödemelerim). */
  @Auth()
  @Get('me/service-payments')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.servicePayment.findMany({ where: { payerId: u.id, status: { not: 'pending' } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((p) => ({ id: p.id, subjectKind: p.subjectKind, subjectId: p.subjectId, amountKurus: p.amountKurus, feeKurus: p.feeKurus, status: p.status, paidAt: p.paidAt }));
  }

  /** Deneme ödeme sayfası için (yalnızca ödeyen). */
  @Auth()
  @Get('service-payments/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const p = await this.prisma.servicePayment.findFirst({ where: { id, payerId: u.id } });
    if (!p) throw Errors.notFound();
    return { id: p.id, subjectKind: p.subjectKind, subjectId: p.subjectId, amountKurus: p.amountKurus, feeKurus: p.feeKurus, status: p.status };
  }

  @Auth(STAFF)
  @Get('admin/service-payments')
  async list(@Query('status') status?: string) {
    const ok = ['pending', 'held', 'released', 'refunded', 'failed'];
    const rows = await this.prisma.servicePayment.findMany({
      where: status && ok.includes(status) ? { status: status as 'held' } : { status: { not: 'pending' } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
    // Sorun bildirilmiş ve hâlâ emanette olanlar en üstte (ekibin kararını bekliyor).
    rows.sort((a, b) => Number(!!b.disputedAt && b.status === 'held') - Number(!!a.disputedAt && a.status === 'held'));
    const provs = await this.prisma.providerProfile.findMany({ where: { id: { in: rows.map((r) => r.providerId) } }, select: { id: true, displayName: true } });
    return rows.map((p) => ({ ...p, providerName: provs.find((x) => x.id === p.providerId)?.displayName ?? null }));
  }

  @Auth(ADMIN)
  @Post('admin/service-payments/:id/refund')
  @HttpCode(200)
  refund(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.escrow.refund(id, u.id);
  }

  /** Anlaşmazlıkta ekip parayı hizmet verene aktarır (iş/rezervasyon tamamlanmış sayılır). */
  @Auth(ADMIN)
  @Post('admin/service-payments/:id/release')
  @HttpCode(200)
  async release(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const p = await this.prisma.servicePayment.findUnique({ where: { id } });
    if (!p) throw Errors.notFound();
    await this.escrow.assertNotParty(p, u.id);
    await this.escrow.release(p, u.id);
    await finishSubject(this.prisma, this.logbook, p.subjectKind, p.subjectId);
    return { id, status: 'released' };
  }
}

@Module({
  imports: [BoatsModule, ListingsModule, PromotionsModule],
  controllers: [ProvidersController, JobsController, BookingsController, ServicePaymentsController],
  providers: [EscrowSweeper],
})
export class MarketplaceModule {}
