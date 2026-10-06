import { Inject, Injectable } from '@nestjs/common';
import type { ServicePayment } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { env } from '../../config/env';
import { LEGAL_VERSION } from '../../common/legal';
import { WEB_PAYMENT, assertPaymentsOn, type WebCallback, type WebPaymentProvider } from '../../adapters/payments';
import { NotificationsService } from '../notifications/notifications.module';

export type EscrowSubject = 'job' | 'captain';
/** Ödeyenden alınan platform payı (hizmet bedelinin yüzdesi). */
export const feeOf = (amountKurus: number) => Math.round((amountKurus * env().SERVICE_FEE_PERCENT) / 100);
const alreadyPaid = () => new AppError('ALREADY_PAID', 'errors.already_paid', 409);
const DAY_MS = 864e5;
/** Usta "işi bitirdim" dedikten sonra sahibi bu kadar gün içinde onaylamaz ya da sorun bildirmezse para aktarılır. */
export const JOB_AUTO_RELEASE_DAYS = 7;
/** Kaptan kiralaması bitişinden bu kadar gün sonra (sorun bildirilmediyse) para aktarılır. */
export const CAPTAIN_AUTO_RELEASE_DAYS = 3;

/**
 * Emanet ödeme: ödeyen hizmet bedeli + platform payını sanal POS'ta öder, para platformda bekler (`held`).
 * İş ya da rezervasyon tamamlanınca hizmet verene aktarılır (`released`); anlaşmazlıkta ekip iade eder (`refunded`).
 * Sonucu yalnızca imzalı sağlayıcı bildirimi belirler (sipariş ödemeleriyle aynı yol).
 */
@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(WEB_PAYMENT) private readonly web: WebPaymentProvider,
  ) {}

  /** Ödeme başlatır; bekleyen ödeme varsa yeni bağlantıyla sürer, ödenmişse 409. */
  async checkout(o: { payerId: string; providerId: string; subjectKind: EscrowSubject; subjectId: string; amountKurus: number }) {
    assertPaymentsOn();
    const existing = await this.prisma.servicePayment.findMany({ where: { subjectKind: o.subjectKind, subjectId: o.subjectId, status: { in: ['held', 'released'] } } });
    if (existing.length) throw alreadyPaid();
    const p = await this.prisma.servicePayment.create({ data: { ...o, feeKurus: feeOf(o.amountKurus) } });
    const { providerRef, checkoutUrl } = await this.web.createCheckout({ orderId: p.id, amountKurus: p.amountKurus + p.feeKurus, kind: 'service' });
    await this.prisma.servicePayment.update({ where: { id: p.id }, data: { providerRef } });
    await this.audit.log(o.payerId, 'audit.preinfoAccepted', { version: LEGAL_VERSION }, 'servicePayment', p.id);
    return { paymentId: p.id, checkoutUrl, amountKurus: p.amountKurus, feeKurus: p.feeKurus };
  }

  /** Sağlayıcı bildirimi bir emanet ödemesine aitse işler ve true döner; değilse false (sipariş olabilir). */
  async applyCallback(c: WebCallback): Promise<boolean> {
    const p = await this.prisma.servicePayment.findFirst({ where: { id: c.orderId, providerRef: c.providerRef } });
    if (!p) return false;
    if (p.amountKurus + p.feeKurus !== c.amountKurus) throw new AppError('AMOUNT_MISMATCH', 'errors.amount_mismatch', 409);
    if (c.result === 'failure') {
      await this.prisma.servicePayment.updateMany({ where: { id: p.id, status: 'pending' }, data: { status: 'failed' } });
      return true;
    }
    // Aynı bildirim iki kez gelirse ikincisi bir şey değiştirmez.
    // Ödeme sayfası açıkken iş iptal edildiyse, rezervasyon geri çevrildiyse ya da tarih başka ödenmiş
    // rezervasyonla çakışıyorsa para emanete alınmaz, iade edilir ('void').
    const done = await this.prisma.$transaction(async (tx) => {
      const r = await tx.servicePayment.updateMany({ where: { id: p.id, status: 'pending' }, data: { status: 'held', paidAt: new Date() } });
      if (!r.count) return false;
      let ok: boolean;
      if (p.subjectKind === 'job') ok = (await tx.job.updateMany({ where: { id: p.subjectId, status: 'accepted' }, data: { status: 'paid' } })).count === 1;
      else {
        const b = await tx.captainBooking.findUnique({ where: { id: p.subjectId } });
        const end = b ? new Date(b.start.getTime() + b.days * DAY_MS) : null;
        const busy = b && end ? await tx.captainBooking.findMany({ where: { providerId: b.providerId, status: 'paid', id: { not: b.id }, start: { lt: end } } }) : [];
        const clash = b ? busy.some((x) => x.start.getTime() + x.days * DAY_MS > b.start.getTime()) : true;
        ok = !clash && (await tx.captainBooking.updateMany({ where: { id: p.subjectId, status: 'requested' }, data: { status: 'paid' } })).count === 1;
        // Kiralama bitişinden sonra kendiliğinden aktarılır (müşteri sorun bildirmediyse).
        if (ok && b) await tx.servicePayment.update({ where: { id: p.id }, data: { autoReleaseAt: new Date(b.start.getTime() + (b.days + CAPTAIN_AUTO_RELEASE_DAYS) * DAY_MS) } });
      }
      if (!ok) {
        await tx.servicePayment.update({ where: { id: p.id }, data: { status: 'refunded', refundedAt: new Date() } });
        return 'void' as const;
      }
      return true;
    });
    if (done === 'void') {
      await this.notifications.push(p.payerId, 'notif.paymentRefunded', { amount: String(Math.round((p.amountKurus + p.feeKurus) / 100)) });
      await this.audit.log(null, 'audit.paymentRefunded', { ref: p.id }, 'payment', p.id);
    } else if (done) {
      const prov = await this.prisma.providerProfile.findUnique({ where: { id: p.providerId } });
      if (prov) await this.notifications.push(prov.userId, 'notif.servicePaid', { kind: p.subjectKind, id: p.subjectId });
      await this.audit.log(p.payerId, 'audit.servicePaid', { kind: p.subjectKind, amount: String(Math.round((p.amountKurus + p.feeKurus) / 100)) }, 'payment', p.id);
    }
    return true;
  }

  /** Konunun emanetteki ödemesi (yoksa null). */
  held(subjectKind: EscrowSubject, subjectId: string) {
    return this.prisma.servicePayment.findFirst({ where: { subjectKind, subjectId, status: 'held' } });
  }

  /** Usta işi teslim etti: otomatik aktarım süresi başlar. */
  async startAutoRelease(p: ServicePayment, days: number) {
    await this.prisma.servicePayment.update({ where: { id: p.id }, data: { autoReleaseAt: new Date(Date.now() + days * DAY_MS) } });
  }

  /** Ödeyen sorun bildirir: otomatik aktarım durur, ekip iade ya da aktarma kararı verir. */
  async dispute(p: ServicePayment, note: string) {
    const r = await this.prisma.servicePayment.updateMany({ where: { id: p.id, status: 'held', disputedAt: null }, data: { disputedAt: new Date(), disputeNote: note } });
    if (!r.count) throw Errors.conflict('ALREADY_DISPUTED');
    const prov = await this.prisma.providerProfile.findUnique({ where: { id: p.providerId } });
    if (prov) await this.notifications.push(prov.userId, 'notif.paymentDisputed', { kind: p.subjectKind, id: p.subjectId });
    await this.audit.log(p.payerId, 'audit.paymentDisputed', { ref: p.id }, 'payment', p.id);
  }

  /** Süresi dolmuş, itirazsız emanetler (otomatik aktarım taraması için). */
  dueForRelease(now = new Date()) {
    return this.prisma.servicePayment.findMany({ where: { status: 'held', disputedAt: null, autoReleaseAt: { lte: now } }, take: 200 });
  }

  /** İş ya da rezervasyon tamamlandı: para hizmet verene aktarılır. `actorId` null: süre dolunca sistem aktardı. */
  async release(p: ServicePayment, actorId: string | null) {
    const r = await this.prisma.servicePayment.updateMany({ where: { id: p.id, status: 'held' }, data: { status: 'released', releasedAt: new Date(), decidedById: actorId } });
    if (!r.count) throw Errors.conflict('PAYMENT_NOT_HELD');
    const prov = await this.prisma.providerProfile.findUnique({ where: { id: p.providerId } });
    if (prov) await this.notifications.push(prov.userId, 'notif.paymentReleased', { amount: String(Math.round(p.amountKurus / 100)) });
    await this.audit.log(actorId, 'audit.paymentReleased', { ref: p.id, amount: String(Math.round(p.amountKurus / 100)) }, 'payment', p.id);
  }

  /** Ekip iadesi (anlaşmazlık): emanetteki para ödeyene döner, iş/rezervasyon iptal olur. */
  async refund(id: string, staffId: string) {
    const p = await this.prisma.servicePayment.findUnique({ where: { id } });
    if (!p) throw Errors.notFound();
    await this.assertNotParty(p, staffId);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.servicePayment.updateMany({ where: { id, status: 'held' }, data: { status: 'refunded', refundedAt: new Date(), decidedById: staffId } });
      if (!r.count) throw Errors.conflict('PAYMENT_NOT_HELD');
      if (p.subjectKind === 'job') await tx.job.update({ where: { id: p.subjectId }, data: { status: 'cancelled' } });
      else await tx.captainBooking.update({ where: { id: p.subjectId }, data: { status: 'cancelled' } });
    });
    await this.notifications.push(p.payerId, 'notif.paymentRefunded', { amount: String(Math.round((p.amountKurus + p.feeKurus) / 100)) });
    await this.audit.log(staffId, 'audit.paymentRefunded', { ref: p.id }, 'payment', p.id);
    return { id, status: 'refunded' };
  }

  /** Ekip üyesi kendi taraf olduğu ödemede (ödeyen ya da hizmet veren) karar veremez. */
  async assertNotParty(p: ServicePayment, staffId: string) {
    const prov = await this.prisma.providerProfile.findUnique({ where: { id: p.providerId }, select: { userId: true } });
    if (p.payerId === staffId || prov?.userId === staffId) throw new AppError('SELF_DECISION', 'errors.self_decision', 403);
  }

  /** Yalnızca deneme modu: ödeyenin deneme sayfasındaki düğmesi; imzalı bildirim sunucuda üretilip aynı yoldan işlenir. */
  async devComplete(payerId: string, id: string, result: 'success' | 'failure', simulate: (c: WebCallback) => { rawBody: string; signature: string }) {
    const p = await this.prisma.servicePayment.findFirst({ where: { id, payerId } });
    if (!p || !p.providerRef) return false;
    const s = simulate({ providerRef: p.providerRef, orderId: p.id, result, amountKurus: p.amountKurus + p.feeKurus });
    await this.applyCallback(this.web.verifyCallback(s.rawBody, s.signature));
    return true;
  }
}
