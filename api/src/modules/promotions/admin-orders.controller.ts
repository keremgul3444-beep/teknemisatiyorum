import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { notPublished, OrdersService } from './orders.service';

/** Para ve fiyat işlemleri yalnızca yöneticide (moderatörde değil). */
const ADMIN = { roles: ['admin'] as ('admin' | 'moderator')[] };
const STATUSES: OrderStatus[] = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
const manualBody = z.object({ listingId: z.string().min(1), productCode: z.string().min(1), note: z.string().trim().min(3).max(200) });
const priceBody = z.object({
  priceWebKurus: z.number().int().min(100).max(100_000_000).optional(),
  priceAppKurus: z.number().int().min(100).max(100_000_000).optional(),
  active: z.boolean().optional(),
});

@Controller('admin')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Auth(ADMIN)
  @Get('orders')
  async list(@Query('status') status?: string) {
    const rows = await this.prisma.order.findMany({
      where: status && STATUSES.includes(status as OrderStatus) ? { status: status as OrderStatus } : {},
      include: { listing: { select: { brand: true, model: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true } });
    return rows.map((o) => ({ ...this.orders.view(o), note: o.note, userName: users.find((x) => x.id === o.userId)?.name ?? null }));
  }

  /** Havale/EFT: yönetici siparişi açıklamasıyla (ör. dekont no) oluşturur ve aynı işlemde öder. */
  @Auth(ADMIN)
  @Post('orders/manual')
  async manual(@CurrentUser() u: AuthUser, @Body(new ZodPipe(manualBody)) b: z.infer<typeof manualBody>) {
    const l = await this.prisma.listing.findUnique({ where: { id: b.listingId } });
    if (!l) throw Errors.notFound();
    if (l.ownerId === u.id) throw new AppError('SELF_DECISION', 'errors.self_decision', 403);
    if (l.status !== 'published') throw notPublished();
    const p = await this.orders.product(b.productCode);
    const orderId = await this.prisma.$transaction(async (db) => {
      const o = await db.order.create({
        data: { userId: l.ownerId, listingId: l.id, productCode: p.code, channel: 'manual', amountKurus: p.priceWebKurus, note: b.note, createdById: u.id },
      });
      await this.orders.markPaid({ id: o.id }, new Date(), db);
      await this.audit.log(u.id, 'audit.orderManual', { product: p.code, note: b.note }, 'order', o.id, db);
      return o.id;
    });
    return { orderId };
  }

  @Auth(ADMIN)
  @Post('orders/:id/refund')
  @HttpCode(204)
  async refund(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.orders.refund(id, u.id);
  }

  /** Fiyat girilince "deneme fiyatı" işareti kalkar. */
  @Auth(ADMIN)
  @Put('products/:code')
  async price(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body(new ZodPipe(priceBody)) b: z.infer<typeof priceBody>) {
    if (!(await this.prisma.product.findUnique({ where: { code } }))) throw Errors.notFound();
    const priced = b.priceWebKurus !== undefined || b.priceAppKurus !== undefined;
    const p = await this.prisma.product.update({ where: { code }, data: { ...b, ...(priced ? { isTrialPrice: false } : {}) } });
    await this.audit.log(u.id, 'audit.productPriceChanged', { code, web: String(p.priceWebKurus), app: String(p.priceAppKurus) }, 'product', code);
    return p;
  }
}
