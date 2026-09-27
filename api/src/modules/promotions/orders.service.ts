import { Inject, Injectable } from '@nestjs/common';
import type { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { STORE_VERIFIER, WEB_PAYMENT, type StoreVerifier, type WebPaymentProvider } from '../../adapters/payments';
import { applyProduct, revertProduct } from './promotion.rules';

const PENDING_TTL_MS = 24 * 3600e3;
export const notPublished = () => new AppError('LISTING_NOT_PUBLISHED', 'errors.listing_not_published', 409);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(WEB_PAYMENT) private readonly web: WebPaymentProvider,
    @Inject(STORE_VERIFIER) private readonly store: StoreVerifier,
  ) {}

  /** Satın alınabilirlik: ilan var, sahibi bu kullanıcı (değilse 404) ve yayında (değilse 409). */
  async assertBuyable(userId: string, listingId: string) {
    const l = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!l || l.ownerId !== userId) throw Errors.notFound();
    if (l.status !== 'published') throw notPublished();
    return l;
  }

  async product(code: string) {
    const p = await this.prisma.product.findUnique({ where: { code } });
    if (!p || !p.active) throw Errors.notFound();
    return p;
  }

  async create(userId: string, listingId: string, productCode: string) {
    await this.assertBuyable(userId, listingId);
    const p = await this.product(productCode);
    const o = await this.prisma.order.create({ data: { userId, listingId, productCode, channel: 'web', amountKurus: p.priceWebKurus } });
    const { providerRef, checkoutUrl } = await this.web.createCheckout({ orderId: o.id, amountKurus: o.amountKurus });
    await this.prisma.order.update({ where: { id: o.id }, data: { providerRef } });
    return { orderId: o.id, checkoutUrl };
  }

  /** Mağaza satın alması: makbuz doğrulanır, sipariş `paid` olarak oluşur ve aynı işlemde etkinleşir. */
  async createFromStore(userId: string, listingId: string, platform: 'ios' | 'android', receipt: string) {
    await this.assertBuyable(userId, listingId);
    const { storeProductId, transactionId } = await this.store.verify(platform, receipt);
    const p = await this.prisma.product.findFirst({
      where: platform === 'ios' ? { iosProductId: storeProductId, active: true } : { androidProductId: storeProductId, active: true },
    });
    if (!p) throw new AppError('BAD_RECEIPT', 'errors.bad_receipt', 400);
    const providerRef = `${platform}:${transactionId}`;
    try {
      return await this.prisma.$transaction(async (db) => {
        const o = await db.order.create({ data: { userId, listingId, productCode: p.code, channel: platform, amountKurus: p.priceAppKurus, providerRef } });
        await this.markPaid({ id: o.id }, new Date(), db);
        return { orderId: o.id, status: 'paid' as const };
      });
    } catch (e) {
      // Aynı makbuz (işlem kimliği) ikinci kez: tekillik ihlali.
      if ((e as { code?: string }).code === 'P2002') throw new AppError('RECEIPT_USED', 'errors.receipt_used', 409);
      throw e;
    }
  }

  /**
   * Tek veritabanı işleminde: yalnızca `pending` (ya da `failed`) siparişi `paid` yapar ve ilanın sürelerini uygular.
   * Geçiş olmadıysa (zaten ödendi, iade vb.) false — aynı bildirimin tekrarı etkisizdir.
   */
  async markPaid(where: { id?: string; providerRef?: string }, now = new Date(), tx?: Prisma.TransactionClient): Promise<boolean> {
    const run = async (db: Prisma.TransactionClient) => {
      const o = await db.order.findFirst({ where, include: { product: true } });
      if (!o) throw Errors.notFound();
      // Başarısız bildirimden sonra gelen geçerli başarı da kabul edilir: para çekildiyse ürün verilir.
      const r = await db.order.updateMany({ where: { id: o.id, status: { in: ['pending', 'failed'] } }, data: { status: 'paid', paidAt: now } });
      if (!r.count) return false;
      await db.$queryRaw`SELECT id FROM "Listing" WHERE id = ${o.listingId} FOR UPDATE`;
      const l = await db.listing.findUniqueOrThrow({ where: { id: o.listingId } });
      await db.listing.update({ where: { id: l.id }, data: applyProduct(l, o.product, now) });
      await this.audit.log(o.userId, 'audit.orderPaid', { product: o.productCode, channel: o.channel }, 'order', o.id, db);
      return true;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  async markFailed(providerRef: string) {
    await this.prisma.order.updateMany({ where: { providerRef, status: 'pending' }, data: { status: 'failed' } });
  }

  /** İade: yalnızca ödenmiş sipariş; süre gün kadar geri çekilir (şimdiden geriye değil). */
  async refund(orderId: string, adminId: string, now = new Date()) {
    await this.prisma.$transaction(async (db) => {
      const o = await db.order.findUnique({ where: { id: orderId }, include: { product: true } });
      if (!o) throw Errors.notFound();
      const r = await db.order.updateMany({ where: { id: o.id, status: 'paid' }, data: { status: 'refunded', refundedAt: now } });
      if (!r.count) throw new AppError('NOT_REFUNDABLE', 'errors.not_refundable', 409);
      await db.$queryRaw`SELECT id FROM "Listing" WHERE id = ${o.listingId} FOR UPDATE`;
      const l = await db.listing.findUniqueOrThrow({ where: { id: o.listingId } });
      await db.listing.update({ where: { id: l.id }, data: revertProduct(l, o.product, now) });
      await this.audit.log(adminId, 'audit.orderRefunded', { product: o.productCode, amount: String(o.amountKurus) }, 'order', o.id, db);
    });
  }

  view(o: Order & { listing?: { brand: string; model: string } | null }, now = new Date()) {
    const stale = o.status === 'pending' && now.getTime() - o.createdAt.getTime() > PENDING_TTL_MS;
    return {
      id: o.id, listingId: o.listingId, listingTitle: o.listing ? `${o.listing.brand} ${o.listing.model}` : null,
      productCode: o.productCode, channel: o.channel, amountKurus: o.amountKurus,
      status: stale ? 'cancelled' : o.status, createdAt: o.createdAt, paidAt: o.paidAt,
    };
  }
}
