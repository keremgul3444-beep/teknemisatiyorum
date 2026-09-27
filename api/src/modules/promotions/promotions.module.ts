import { Module } from '@nestjs/common';
import { paymentProviders, STORE_VERIFIER, WEB_PAYMENT } from '../../adapters/payments';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentsController } from './payments.controller';
import { ProductsController } from './products.controller';

const PROVIDERS = Symbol('PAYMENT_PROVIDERS');
type Providers = ReturnType<typeof paymentProviders>;

@Module({
  controllers: [ProductsController, OrdersController, PaymentsController],
  providers: [
    OrdersService,
    { provide: PROVIDERS, useFactory: paymentProviders },
    { provide: WEB_PAYMENT, useFactory: (p: Providers) => p.web, inject: [PROVIDERS] },
    { provide: STORE_VERIFIER, useFactory: (p: Providers) => p.store, inject: [PROVIDERS] },
  ],
  exports: [OrdersService],
})
export class PromotionsModule {}
