import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CURRENCIES } from '@tms/shared';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { Errors } from '../../common/errors';
import { dateOnly, parseDateOnly } from '../boats/logbook.service';

const bookingBody = z.object({
  packageId: z.string().min(1),
  listingId: z.string().optional(),
  date: z.iso.date(),
  slot: z.enum(['morning', 'noon', 'afternoon']),
});
const brokerBody = z.object({
  boatName: z.string().trim().min(1).max(80),
  askingPrice: z.number().positive().max(1e10),
  currency: z.enum(CURRENCIES),
});

const bookingView = (b: { id: string; packageId: string; listingId: string | null; date: Date; slot: string; reportStatus: string; score: number | null }) => ({
  id: b.id, packageId: b.packageId, listingId: b.listingId, date: dateOnly(b.date), slot: b.slot, reportStatus: b.reportStatus, score: b.score,
});

/** Platformun kendi verdiği hizmetler: ekspertiz randevusu ve broker (satış) dosyası. */
@Controller()
class ServicesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Public()
  @Get('expertise/packages')
  packages() {
    return this.prisma.expertisePackage.findMany({ orderBy: { order: 'asc' } });
  }

  @Auth({ level: 1 })
  @Post('expertise/bookings')
  async book(@CurrentUser() u: AuthUser, @Body(new ZodPipe(bookingBody)) b: z.infer<typeof bookingBody>) {
    if (!(await this.prisma.expertisePackage.count({ where: { id: b.packageId } }))) throw Errors.notFound();
    if (b.listingId) {
      const l = await this.prisma.listing.findUnique({ where: { id: b.listingId } });
      if (!l || (l.ownerId !== u.id && l.status !== 'published')) throw Errors.notFound();
    }
    // Tarih takvim günü olarak saklanır; saat dilimine göre kayma olmaz.
    const row = await this.prisma.expertiseBooking.create({ data: { userId: u.id, packageId: b.packageId, listingId: b.listingId, date: parseDateOnly(b.date), slot: b.slot } });
    await this.audit.log(u.id, 'audit.expertiseBooked', { date: b.date }, 'expertise', row.id);
    return bookingView(row);
  }

  @Auth()
  @Get('me/expertise')
  async myBookings(@CurrentUser() u: AuthUser) {
    return (await this.prisma.expertiseBooking.findMany({ where: { userId: u.id }, orderBy: { date: 'desc' } })).map(bookingView);
  }

  @Auth({ level: 2 })
  @Post('broker/cases')
  async apply(@CurrentUser() u: AuthUser, @Body(new ZodPipe(brokerBody)) b: z.infer<typeof brokerBody>) {
    const c = await this.prisma.brokerCase.create({ data: { userId: u.id, ...b } });
    await this.audit.log(u.id, 'audit.brokerApplied', { boat: b.boatName }, 'broker', c.id);
    return c;
  }

  @Auth()
  @Get('broker/cases/:id')
  async brokerCase(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const c = await this.prisma.brokerCase.findFirst({ where: { id, userId: u.id } });
    if (!c) throw Errors.notFound();
    return c;
  }

  @Auth()
  @Get('me/broker')
  myCases(@CurrentUser() u: AuthUser) {
    return this.prisma.brokerCase.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
  }
}

@Module({ controllers: [ServicesController] })
export class ServicesModule {}
