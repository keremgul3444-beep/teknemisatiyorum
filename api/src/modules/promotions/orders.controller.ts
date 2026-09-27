import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { OrdersService } from './orders.service';

const orderBody = z.object({ listingId: z.string().min(1), productCode: z.string().min(1).max(40) });
const storeBody = z.object({ listingId: z.string().min(1), platform: z.enum(['ios', 'android']), receipt: z.string().min(6).max(20000) });

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly prisma: PrismaService) {}

  @Auth({ level: 1 })
  @Post('orders')
  create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(orderBody)) b: z.infer<typeof orderBody>) {
    return this.orders.create(u.id, b.listingId, b.productCode);
  }

  /** Uygulama içi (Apple/Google) satın alma: makbuz sunucuda doğrulanmadan ürün açılmaz. */
  @Auth({ level: 1 })
  @Post('orders/store')
  store(@CurrentUser() u: AuthUser, @Body(new ZodPipe(storeBody)) b: z.infer<typeof storeBody>) {
    return this.orders.createFromStore(u.id, b.listingId, b.platform, b.receipt);
  }

  @Auth()
  @Get('me/orders')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.order.findMany({
      where: { userId: u.id }, include: { listing: { select: { brand: true, model: true } } }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    return rows.map((o) => this.orders.view(o));
  }

  /** Yalnızca sahibine; başkasının siparişi 404 (varlığı da sızmaz). */
  @Auth()
  @Get('orders/:id')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId: u.id }, include: { listing: { select: { brand: true, model: true } } } });
    if (!o) throw Errors.notFound();
    return this.orders.view(o);
  }
}
