import { Body, Controller, Headers, HttpCode, Inject, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { env } from '../../config/env';
import { DevWebPayment, WEB_PAYMENT, type WebCallback, type WebPaymentProvider } from '../../adapters/payments';
import { OrdersService } from './orders.service';

const devBody = z.object({ orderId: z.string().min(1), result: z.enum(['success', 'failure']) });

@Controller('payments/web')
export class PaymentsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    @Inject(WEB_PAYMENT) private readonly web: WebPaymentProvider,
  ) {}

  /** Sanal POS'un sunucuya bildirimi. Tarayıcının dönüş sayfası sonucu belirlemez; yalnızca bu. */
  @Public()
  @SkipThrottle()
  @Post('callback')
  @HttpCode(200)
  async callback(@Req() req: RawBodyRequest<Request>, @Headers('x-signature') sig: string | undefined) {
    await this.apply(this.web.verifyCallback(req.rawBody?.toString('utf8') ?? '', sig));
    return { ok: true };
  }

  /** Yalnızca deneme modu: site deneme sayfasındaki düğmeler; sunucu imzalı bildirimi üretip aynı yoldan işler. */
  @Auth()
  @Post('dev-complete')
  @HttpCode(200)
  async devComplete(@CurrentUser() u: AuthUser, @Body(new ZodPipe(devBody)) b: z.infer<typeof devBody>) {
    if (env().PAYMENTS_MODE !== 'dev' || !(this.web instanceof DevWebPayment)) throw Errors.notFound();
    const o = await this.prisma.order.findFirst({ where: { id: b.orderId, userId: u.id } });
    if (!o || !o.providerRef) throw Errors.notFound();
    const s = this.web.simulate({ providerRef: o.providerRef, orderId: o.id, result: b.result, amountKurus: o.amountKurus });
    await this.apply(this.web.verifyCallback(s.rawBody, s.signature));
    return { ok: true };
  }

  private async apply(c: WebCallback) {
    const o = await this.prisma.order.findFirst({ where: { id: c.orderId, providerRef: c.providerRef } });
    if (!o) throw Errors.notFound();
    if (o.amountKurus !== c.amountKurus) throw new AppError('AMOUNT_MISMATCH', 'errors.amount_mismatch', 409);
    if (c.result === 'failure') await this.orders.markFailed(c.providerRef);
    else await this.orders.markPaid({ providerRef: c.providerRef });
  }
}
