import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { env } from '../../config/env';
import { reportError } from '../../adapters/error-report';

/** Özetin gönderildiği saat (İstanbul saatiyle) ve gün başı ofseti. */
export const DIGEST_HOUR = 9;
const TR_OFFSET_MS = 3 * 3600e3;

/**
 * Ekibe günlük "bekleyen işler" özeti: her sabah 09.00'dan sonra bir kez, bekleyen bir şey varsa.
 * Aynı gün ikinci kez gitmez (yeniden başlatmada da: bugünün özeti bildirim tablosunda aranır).
 */
@Injectable()
export class StaffDigest implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('StaffDigest');
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /** Döner: gönderildiyse sayılar, değilse null. */
  async run(now = new Date()) {
    const local = new Date(now.getTime() + TR_OFFSET_MS);
    if (local.getUTCHours() < DIGEST_HOUR) return null;
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TR_OFFSET_MS);
    if (await this.prisma.notification.count({ where: { key: 'notif.staffDigest', createdAt: { gte: dayStart } } })) return null;
    const [listings, docs, reports, disputes, leads] = await Promise.all([
      this.prisma.listing.count({ where: { OR: [{ status: 'pending' }, { status: 'published', pendingAt: { not: null } }] } }),
      this.prisma.verificationRequest.count({ where: { status: 'pending' } }),
      this.prisma.listingReport.count({ where: { status: 'open' } }),
      this.prisma.servicePayment.count({ where: { status: 'held', disputedAt: { not: null } } }),
      this.prisma.leadRequest.count({ where: { status: 'new' } }),
    ]);
    if (!listings && !docs && !reports && !disputes && !leads) return null;
    const counts = { listings: String(listings), docs: String(docs), reports: String(reports), disputes: String(disputes), leads: String(leads) };
    await this.notifications.pushStaff('notif.staffDigest', counts);
    return counts;
  }

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const tick = () => this.run().then((c) => c && this.log.log('Ekibe günlük özet gönderildi')).catch((e) => { this.log.error(`Günlük özet: ${e}`); void reportError(e, { job: 'staff-digest' }); });
    this.timer = setInterval(tick, 15 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
