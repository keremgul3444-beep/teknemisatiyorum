import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { Listing } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { env } from '../../config/env';

const DAY_MS = 864e5;
/** Onaylanan ya da yenilenen ilan bu kadar gün yayında kalır; satılmış ama işaretlenmemiş ilanlar sonsuza kadar durmaz. */
export const LISTING_DAYS = 90;
/** Bitişe bu kadar gün kala sahibine haber verilir ve yenileme açılır. */
export const RENEW_WINDOW_DAYS = 14;
export const WARN_DAYS = 7;

export const nextExpiry = (now = new Date()) => new Date(now.getTime() + LISTING_DAYS * DAY_MS);

/** Yenilenebilir mi: süresi dolmuş ya da bitişine 14 günden az kalmış yayındaki ilan. */
export function canRenew(l: Pick<Listing, 'status' | 'expiresAt'>, now = new Date()): boolean {
  if (l.status === 'expired') return true;
  return l.status === 'published' && !!l.expiresAt && l.expiresAt.getTime() - now.getTime() <= RENEW_WINDOW_DAYS * DAY_MS;
}

@Injectable()
export class ListingExpiry implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Expiry');
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /** Bitişi yaklaşanlara bir kez haber verir, süresi dolanları `expired` yapar. Kaç ilanın düştüğünü döner. */
  async sweep(now = new Date()) {
    const soon = await this.prisma.listing.findMany({
      where: { status: 'published', expiresAt: { gt: now, lte: new Date(now.getTime() + WARN_DAYS * DAY_MS) }, expiryWarnedAt: null },
    });
    for (const l of soon) {
      const days = String(Math.max(1, Math.ceil((l.expiresAt!.getTime() - now.getTime()) / DAY_MS)));
      await this.prisma.listing.update({ where: { id: l.id }, data: { expiryWarnedAt: now } });
      await this.notifications.push(l.ownerId, 'notif.listingExpiring', { title: `${l.brand} ${l.model}`, listingId: l.id, days });
    }
    const due = await this.prisma.listing.findMany({ where: { status: 'published', expiresAt: { lte: now } } });
    for (const l of due) {
      // Koşullu güncelleme: aynı anda yenilenen ilan düşürülmez.
      const r = await this.prisma.listing.updateMany({ where: { id: l.id, status: 'published', expiresAt: { lte: now } }, data: { status: 'expired' } });
      if (r.count) await this.notifications.push(l.ownerId, 'notif.listingExpired', { title: `${l.brand} ${l.model}`, listingId: l.id });
    }
    return due.length;
  }

  onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    const run = () => this.sweep().then((n) => n && this.log.log(`${n} ilanın süresi doldu`)).catch((e) => this.log.error(`Süre taraması yapılamadı: ${e}`));
    run();
    this.timer = setInterval(run, 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
