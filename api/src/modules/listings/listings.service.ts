import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { failures, MAX_LISTING_PHOTOS, normalizeLocation, type BoatType, type Equipment, type ParsedQuery, type Criterion } from '@tms/shared';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { FxService } from './fx.service';
import { listingInclude, listingView, priceDropOf, PRICE_DROP_DAYS, type ListingRow, type ListingStats } from './listing.view';
import { NotificationsService } from '../notifications/notifications.module';
import { freshness, isActive } from '../promotions/promotion.rules';

export const MAX_PHOTOS = MAX_LISTING_PHOTOS;
export type Sort = 'new' | 'asc' | 'desc';

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/**
 * Eşleştirme için yeterli sütunlar: arama önce yalnızca bunları okur, tam ilan (fotoğraf, sahip, karne) yalnızca
 * gösterilecek sayfa için yüklenir. Binlerce ilanda bellek ve süre ilan sayısıyla değil sayfa boyuyla büyür.
 */
const MATCH_SELECT = {
  id: true, lengthM: true, year: true, price: true, currency: true, type: true, location: true, equipment: true,
  engineHours: true, flag: true, tradeIn: true, negotiable: true,
  publishedAt: true, bumpedAt: true, featuredUntil: true, urgentUntil: true,
  priceHistory: { orderBy: { at: 'desc' as const }, take: 1 },
} satisfies Prisma.ListingSelect;
type Slim = Prisma.ListingGetPayload<{ select: typeof MATCH_SELECT }>;
const asMatchable = (l: Slim) => ({ ...l, status: 'published', type: l.type as BoatType, equipment: l.equipment as Equipment[] });
/** Asistanın tam eşleşme listesi en fazla bu kadar ilan döndürür (yanıt boyutu sınırsız büyümesin). */
export const MAX_ASSISTANT_EXACT = 50;

/** Aynı kişinin aynı ilanı yeniden açması bu süre içinde tekrar sayılmaz. */
export const VIEW_DEDUPE_MS = 30 * 60 * 1000;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService, private readonly fx: FxService, private readonly notifications: NotificationsService) {}

  /** Sahibi değilse yalnızca yayındaki (ve satılmış) ilanlar görünür; aksi halde 404 (varlığı da sızdırılmaz). */
  async getVisible(id: string, viewerId?: string, staff = false) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: listingInclude });
    // Moderasyon için ekip her durumdaki ilanı görür; diğerleri yalnızca yayındaki/satılmış ilanları.
    if (!l || (l.ownerId !== viewerId && !staff && !['published', 'sold'].includes(l.status))) throw Errors.notFound();
    return l;
  }

  async getOwn(id: string, userId: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: listingInclude });
    if (!l || l.ownerId !== userId) throw Errors.notFound();
    return l;
  }

  async view(l: ListingRow, viewerId?: string, stats?: ListingStats) {
    const company = l.companyId ? await this.prisma.company.findUnique({ where: { id: l.companyId } }) : null;
    return listingView(l, viewerId, company?.name, stats);
  }

  /**
   * İlan sahibi dışındaki herkese açık görüntülemeyi sayar (yanıtı bekletmez). Aynı kişi (hesap ya da IP)
   * aynı ilanı 30 dakika içinde yeniden açarsa sayılmaz: yenilemeler ve geri dönüşler istatistiği şişirmesin.
   */
  countView(l: Pick<ListingRow, 'id' | 'ownerId' | 'status'>, viewerId?: string, ip?: string, now = Date.now()) {
    if (l.ownerId === viewerId || l.status !== 'published') return;
    const key = `${l.id}:${viewerId ?? `ip:${ip ?? '?'}`}`;
    const seen = this.recentViews.get(key);
    if (seen && now - seen < VIEW_DEDUPE_MS) return;
    if (this.recentViews.size > 50_000) this.recentViews.clear();
    this.recentViews.set(key, now);
    this.prisma.listing.update({ where: { id: l.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  }
  private readonly recentViews = new Map<string, number>();

  /** İlanlarım için: görüntülenme, favori ve sohbet sayıları (iki toplu sorgu). */
  async statsFor(rows: ListingRow[]) {
    const ids = rows.map((l) => l.id);
    const [favs, convs] = await Promise.all([
      this.prisma.favorite.groupBy({ by: ['listingId'], where: { listingId: { in: ids } }, _count: { _all: true } }),
      this.prisma.conversation.groupBy({ by: ['subjectId'], where: { subjectKind: 'listing', subjectId: { in: ids } }, _count: { _all: true } }),
    ]);
    const f = new Map(favs.map((x) => [x.listingId, x._count._all]));
    const c = new Map(convs.map((x) => [x.subjectId, x._count._all]));
    return new Map<string, ListingStats>(rows.map((l) => [l.id, { views: l.viewCount, favorites: f.get(l.id) ?? 0, messages: c.get(l.id) ?? 0 }]));
  }

  /** Seçilen kimliklerin tam kayıtları, verilen sırayla. */
  private async full(ids: string[]): Promise<ListingRow[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.listing.findMany({ where: { id: { in: ids } }, include: listingInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is ListingRow => !!r);
  }

  /** Veritabanında kaba süzme (tip, konum, yıl, boy, yeni alanlar) + fiyat/donanım için ortak `failures` kuralı (kur tablosuyla). */
  private async matchSlim(q: ParsedQuery, extraWhere: Prisma.ListingWhereInput = {}) {
    // Kayıtlardaki konum tek biçimde; aranan da aynı biçime getirilir ("bodrum" → "Bodrum").
    if (q.location) q = { ...q, location: normalizeLocation(q.location) };
    const where: Prisma.ListingWhereInput = {
      ...extraWhere,
      status: 'published',
      ...(q.type ? { type: q.type } : {}),
      ...(q.location ? { location: q.location } : {}),
      ...(q.minYear !== undefined || q.maxYear !== undefined ? { year: { gte: q.minYear, lte: q.maxYear } } : {}),
      ...(q.minLength !== undefined || q.maxLength !== undefined ? { lengthM: { gte: q.minLength, lte: q.maxLength } } : {}),
      ...(q.maxEngineHours !== undefined ? { engineHours: { lte: q.maxEngineHours } } : {}),
      ...(q.flag ? { flag: q.flag } : {}),
      ...(q.tradeIn ? { tradeIn: true } : {}),
      ...(q.negotiable ? { negotiable: true } : {}),
    };
    const rows = await this.prisma.listing.findMany({ where, select: MATCH_SELECT, orderBy: { year: 'desc' } });
    const rates = await this.fx.rates();
    return { rows: rows.filter((l) => failures(asMatchable(l), q, rates).length === 0), rates };
  }

  /** Kayıtlı aramalar için: aramaya uyan ilanların tam kayıtları. */
  async match(q: ParsedQuery, extraWhere: Prisma.ListingWhereInput = {}) {
    const { rows, rates } = await this.matchSlim(q, extraWhere);
    return { rows: await this.full(rows.map((r) => r.id)), rates };
  }

  /** Asistan için: tam eşleşenler (en fazla MAX_ASSISTANT_EXACT) + tek kriteri eksik yakın sonuçlar (yayındaki tüm ilanlar üzerinde). */
  async matchWithNear(q: ParsedQuery, limitNear = 5) {
    const rates = await this.fx.rates();
    const rows = await this.prisma.listing.findMany({ where: { status: 'published' }, select: MATCH_SELECT, orderBy: { year: 'desc' } });
    const exactIds: string[] = [];
    const nearSlim: { id: string; missing: Criterion[] }[] = [];
    for (const l of rows) {
      const f = failures(asMatchable(l), q, rates);
      if (f.length === 0) { if (exactIds.length < MAX_ASSISTANT_EXACT) exactIds.push(l.id); }
      else if (f.length === 1 && nearSlim.length < limitNear) nearSlim.push({ id: l.id, missing: f });
    }
    const [exact, nearRows] = await Promise.all([this.full(exactIds), this.full(nearSlim.map((n) => n.id))]);
    const near = nearRows.map((listing, i) => ({ listing, missing: nearSlim[i].missing }));
    return { exact, near, rates };
  }

  async search(q: ParsedQuery, sort: Sort, page: number, opts: { urgentOnly?: boolean; dropOnly?: boolean; now?: Date } = {}, pageSize = 20) {
    const now = opts.now ?? new Date();
    const { rows: all, rates } = await this.matchSlim(q);
    const rows = all.filter((l) => (!opts.urgentOnly || isActive(l.urgentUntil, now)) && (!opts.dropOnly || priceDropOf(l, now)));
    const tl = (l: Slim) => l.price * rates[l.currency];
    if (sort !== 'new') rows.sort((a, b) => (sort === 'asc' ? tl(a) - tl(b) : tl(b) - tl(a)));
    else rows.sort((a, b) => freshness(b) - freshness(a));
    // Aramaya uyan vitrin ilanlarından en fazla 3'ü üstte (karışık); normal listede de yerlerinde kalırlar.
    const featuredIds = shuffle(rows.filter((l) => isActive(l.featuredUntil, now))).slice(0, 3).map((l) => l.id);
    const pageIds = rows.slice((page - 1) * pageSize, page * pageSize).map((l) => l.id);
    const [pageRows, featuredTop] = await Promise.all([this.full(pageIds), this.full(featuredIds)]);
    return { rows: pageRows, total: rows.length, featuredTop };
  }

  /** Ana sayfa: ≤8 vitrin (karışık), ≤8 acil (en taze), ≤8 fiyatı düşen (en yeni indirim). */
  async showcase(now = new Date()) {
    const since = new Date(now.getTime() - PRICE_DROP_DAYS * 864e5);
    const [featured, urgent, dropped] = await Promise.all([
      this.prisma.listing.findMany({ where: { status: 'published', featuredUntil: { gt: now } }, include: listingInclude }),
      this.prisma.listing.findMany({ where: { status: 'published', urgentUntil: { gt: now } }, include: listingInclude }),
      this.prisma.listing.findMany({ where: { status: 'published', priceHistory: { some: { at: { gt: since } } } }, include: listingInclude }),
    ]);
    const priceDrops = dropped.filter((l) => priceDropOf(l, now)).sort((a, b) => b.priceHistory[0].at.getTime() - a.priceHistory[0].at.getTime()).slice(0, 8);
    return { featured: shuffle(featured).slice(0, 8), urgent: urgent.sort((a, b) => freshness(b) - freshness(a)).slice(0, 8), priceDrops };
  }

  /** Fiyat düşünce ilanı favorileyenlere (sahibi hariç) uygulama içi bildirim. */
  async notifyPriceDrop(l: ListingRow, from: number) {
    const favs = await this.prisma.favorite.findMany({ where: { listingId: l.id, userId: { not: l.ownerId } }, select: { userId: true } });
    const params = { listingId: l.id, title: `${l.brand} ${l.model}`, from: String(from), to: String(l.price), currency: l.currency };
    await Promise.all(favs.map((f) => this.notifications.push(f.userId, 'notif.priceDrop', params)));
  }

  /** Site haritası ve hazır arama sayfaları: yayındaki ilanlar + tip ve tip×şehir sayıları. */
  async sitemap() {
    const rows = await this.prisma.listing.findMany({
      where: { status: 'published' },
      select: { id: true, brand: true, model: true, year: true, type: true, location: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    const counts = new Map<string, { type: string; location: string | null; count: number }>();
    for (const r of rows) {
      for (const location of [null, r.location]) {
        const k = `${r.type}|${location ?? ''}`;
        const c = counts.get(k) ?? { type: r.type, location, count: 0 };
        c.count++;
        counts.set(k, c);
      }
    }
    return { listings: rows, facets: [...counts.values()] };
  }
}
