import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { maskPhone } from '@tms/shared';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';

const STAFF = { roles: ['moderator', 'admin'] as ('moderator' | 'admin')[] };
export const LEAD_KINDS = ['finance', 'insurance', 'transport'] as const;
/** Kişi başına günde en fazla talep. */
export const LEADS_PER_DAY = 5;

const body = z.object({
  kind: z.enum(LEAD_KINDS),
  listingId: z.string().min(1).max(40).optional(),
  note: z.string().trim().max(500).default(''),
  /** Bilgilerin teklif için iş ortağıyla paylaşılmasına açık izin (zorunlu). */
  consent: z.literal(true),
});
const statusBody = z.object({ status: z.enum(['forwarded', 'closed']) });

/**
 * Finansman, sigorta ve nakliye teklifi: kullanıcı açık izinle talep bırakır, ekip yönetim ekranından görür ve
 * anlaşmalı iş ortağına iletir (otomatik paylaşım yok). Ad ve telefon talep anında hesaptan kopyalanır.
 */
@Controller()
class LeadsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Auth({ level: 1 })
  @Post('leads')
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(body)) b: z.infer<typeof body>) {
    const today = await this.prisma.leadRequest.count({ where: { userId: u.id, createdAt: { gt: new Date(Date.now() - 864e5) } } });
    if (today >= LEADS_PER_DAY) throw Errors.tooMany('LEAD_LIMIT');
    if (b.listingId && !(await this.prisma.listing.count({ where: { id: b.listingId, status: 'published' } }))) throw Errors.notFound();
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { name: true, phone: true } });
    if (!me.phone) throw new AppError('PHONE_REQUIRED', 'errors.phone_required', 400);
    const l = await this.prisma.leadRequest.create({
      data: { userId: u.id, listingId: b.listingId, kind: b.kind, note: b.note, name: me.name, phone: me.phone, consentAt: new Date() },
    });
    await this.audit.log(u.id, 'audit.leadRequested', { kind: b.kind }, 'lead', l.id);
    return { id: l.id, kind: l.kind, status: l.status, createdAt: l.createdAt };
  }

  @Auth(STAFF)
  @Get('admin/leads')
  async list(@Query('status') status?: string) {
    const rows = await this.prisma.leadRequest.findMany({
      where: status && ['new', 'forwarded', 'closed'].includes(status) ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: rows.map((r) => r.listingId).filter((x): x is string => !!x) } }, select: { id: true, brand: true, model: true, year: true, price: true, currency: true },
    });
    // Listede numara maskeli; tam numara talep başına "göster" ile açılır ve işlem kaydına yazılır.
    return rows.map((r) => ({
      id: r.id, kind: r.kind, status: r.status, note: r.note, name: r.name, phoneMasked: r.phone ? maskPhone(r.phone) : null,
      createdAt: r.createdAt, handledAt: r.handledAt, listing: listings.find((l) => l.id === r.listingId) ?? null,
    }));
  }

  /** İş ortağına iletmek için tam numara; her açılış kayda geçer. */
  @Auth(STAFF)
  @Post('admin/leads/:id/reveal')
  @HttpCode(200)
  async reveal(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.prisma.leadRequest.findUnique({ where: { id }, select: { id: true, phone: true } });
    if (!l) throw Errors.notFound();
    await this.audit.log(u.id, 'audit.leadRevealed', {}, 'lead', id);
    return { id, phone: l.phone };
  }

  @Auth(STAFF)
  @Post('admin/leads/:id/status')
  @HttpCode(200)
  async setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(statusBody)) b: z.infer<typeof statusBody>) {
    const r = await this.prisma.leadRequest.updateMany({ where: { id }, data: { status: b.status, handledAt: new Date() } });
    if (!r.count) throw Errors.notFound();
    await this.audit.log(u.id, 'audit.leadHandled', { status: b.status }, 'lead', id);
    return { id, status: b.status };
  }
}

@Module({ controllers: [LeadsController] })
export class LeadsModule {}
