import { Body, Controller, Delete, Get, Headers, HttpCode, Ip, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { BOAT_TYPES, CURRENCIES, EQUIPMENT, FLAGS, MAX_ENGINE_HOURS, MAX_REPORTS_PER_DAY, REPORT_REASONS, normalizeLocation, parsedQuerySchema } from '@tms/shared';
import { Auth, CurrentUser, OptionalUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { Errors } from '../../common/errors';
import { MediaService } from '../media/media.service';
import { ListingsService, MAX_PHOTOS } from './listings.service';
import { listingInclude, priceNeedsReview, PRICE_CHANGES_PER_WEEK, type ListingRow } from './listing.view';
import { canRenew, nextExpiry } from './expiry';

/** Kullanıcı başına açık (gönderilmemiş) taslak sınırı. */
const MAX_OPEN_DRAFTS = 5;

const draftSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1900).max(2100),
  lengthM: z.number().positive().max(200),
  type: z.enum(BOAT_TYPES),
  price: z.number().positive().max(1e10),
  currency: z.enum(CURRENCIES),
  location: z.string().trim().min(1).max(40).transform(normalizeLocation),
  equipment: z.array(z.enum(EQUIPMENT)).max(8).default([]),
  cabins: z.number().int().min(0).max(50).default(0),
  engine: z.string().trim().max(80).default(''),
  description: z.string().trim().max(4000).default(''),
  engineHours: z.number().int().min(0).max(MAX_ENGINE_HOURS).nullable().default(null),
  flag: z.enum(FLAGS).nullable().default(null),
  tradeIn: z.boolean().default(false),
  negotiable: z.boolean().default(false),
  companyId: z.string().optional(),
  boatId: z.string().optional(),
});
// Kısmi güncellemede varsayılanlar uygulanmaz: yalnızca fiyat gönderen istek donanımı/açıklamayı silmesin.
const patchSchema = draftSchema.partial().extend({
  equipment: draftSchema.shape.equipment.unwrap().optional(),
  cabins: draftSchema.shape.cabins.unwrap().optional(),
  engine: draftSchema.shape.engine.unwrap().optional(),
  description: draftSchema.shape.description.unwrap().optional(),
  engineHours: draftSchema.shape.engineHours.unwrap().optional(),
  flag: draftSchema.shape.flag.unwrap().optional(),
  tradeIn: draftSchema.shape.tradeIn.unwrap().optional(),
  negotiable: draftSchema.shape.negotiable.unwrap().optional(),
  /** null: ilan firmadan çıkarılır, bireysel satıcı adıyla görünür. */
  companyId: z.string().nullable().optional(),
});
/** Onaydan geçmiş (ya da reddedilmiş) içerik: değişirse ilan yeniden onaya düşer. Süresi dolan da onaylıdır; düzenlenip yenilenirse denetimsiz yayına çıkmasın. */
const REVIEWED: string[] = ['published', 'rejected', 'expired'];
/** Bu alanlardan biri değişirse ilan başka bir tekneyi anlatıyor olabilir. */
const IDENTITY_FIELDS = ['brand', 'model', 'year', 'lengthM', 'boatId'] as const;
/** Tekneye bağlı (belge/ekspertizle kazanılan) rozetler; satıcının kendi beyanına dayananlar değil. */
const BOAT_BOUND_BADGES = ['sahiplik', 'belge', 'ekspertizli'];
/** Bu başlıkla gelen okuma görüntülenme sayılmaz (sitenin ara katmanı ve sayfa önbelleği). */
export const NO_COUNT_HEADER = 'x-tms-no-count';
const reportSchema = z.object({ reason: z.enum(REPORT_REASONS), note: z.string().trim().max(500).default('') });
const photosSchema = z.object({ fileIds: z.array(z.string().min(1)).min(1).transform((a) => [...new Set(a)]) });
const mineQuery = z.object({ status: z.enum(['draft', 'pending', 'published', 'rejected', 'sold', 'removed', 'expired']).optional() });
const searchQuery = z.object({
  q: z.string().max(2000).optional().transform((s, ctx) => {
    if (!s) return { equipment: [] };
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'json' });
      return z.NEVER;
    }
  }).pipe(parsedQuerySchema),
  sort: z.enum(['new', 'asc', 'desc']).default('new'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  urgent: z.enum(['1']).optional(),
  drop: z.enum(['1']).optional(),
});

@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get('listings')
  async search(@OptionalUser() u: AuthUser | undefined, @Query(new ZodPipe(searchQuery)) q: z.infer<typeof searchQuery>) {
    const { rows, total, featuredTop } = await this.listings.search(q.q, q.sort, q.page, { urgentOnly: q.urgent === '1', dropOnly: q.drop === '1' });
    const view = (l: ListingRow) => this.listings.view(l, u?.id);
    return { items: await Promise.all(rows.map(view)), total, featuredTop: await Promise.all(featuredTop.map(view)) };
  }

  // Sabit yollar `listings/:id`'den önce tanımlanır (yoksa "showcase" bir ilan kimliği sanılır).
  @Public()
  @Get('listings/showcase')
  async showcase(@OptionalUser() u: AuthUser | undefined) {
    const s = await this.listings.showcase();
    const view = (l: ListingRow) => this.listings.view(l, u?.id);
    return { featured: await Promise.all(s.featured.map(view)), urgent: await Promise.all(s.urgent.map(view)), priceDrops: await Promise.all(s.priceDrops.map(view)) };
  }

  @Public()
  @Get('listings/sitemap')
  sitemap() {
    return this.listings.sitemap();
  }

  @Public()
  @Get('listings/:id')
  async get(@OptionalUser() u: AuthUser | undefined, @Param('id') id: string, @Ip() ip: string, @Headers(NO_COUNT_HEADER) noCount?: string) {
    const staff = !!u?.roles.some((r) => r === 'admin' || r === 'moderator');
    const l = await this.listings.getVisible(id, u?.id, staff);
    // Sitenin ara katmanı ve sayfa önbelleği ilanı okurken sayılmaz; sitede görüntülenme ayrı uçtan (tarayıcıdan) gelir.
    if (!noCount) this.listings.countView(l, u?.id, ip);
    return this.listings.view(l, u?.id);
  }

  /**
   * Alıcı yayındaki bir ilanı bildirir (dolandırıcılık şüphesi, yanlış bilgi, satılmış, uygunsuz içerik).
   * Kişi başına ilan başına bir bildirim; günde en fazla MAX_REPORTS_PER_DAY. İlan kendiliğinden kalkmaz:
   * rakiplerin birkaç hesapla ilan düşürmesini önlemek için kararı moderatör verir.
   */
  @Auth({ level: 1 })
  @Post('listings/:id/report')
  async report(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(reportSchema)) b: z.infer<typeof reportSchema>) {
    const l = await this.listings.getVisible(id, u.id);
    if (l.ownerId === u.id) throw Errors.conflict('OWN_LISTING');
    if (l.status !== 'published') throw Errors.conflict('LISTING_CLOSED');
    const since = new Date(Date.now() - 864e5);
    if (await this.prisma.listingReport.count({ where: { reporterId: u.id, createdAt: { gt: since } } }) >= MAX_REPORTS_PER_DAY) {
      throw Errors.tooMany('REPORT_LIMIT');
    }
    const existing = await this.prisma.listingReport.findUnique({ where: { listingId_reporterId: { listingId: id, reporterId: u.id } } });
    if (existing) throw Errors.conflict('ALREADY_REPORTED');
    const r = await this.prisma.listingReport.create({ data: { listingId: id, reporterId: u.id, reason: b.reason, note: b.note } });
    await this.audit.log(u.id, 'audit.listingReported', { title: `${l.brand} ${l.model}`, reason: b.reason }, 'listing', id);
    return { id: r.id, status: r.status };
  }

  /** Sitedeki ilan sayfası tarayıcıda açılınca bir kez çağrılır (botlar ve ön yüklemeler sayılmaz). Yanıt her zaman 204. */
  @Public()
  @Post('listings/:id/view')
  @HttpCode(204)
  async viewed(@OptionalUser() u: AuthUser | undefined, @Param('id') id: string, @Ip() ip: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, select: { id: true, ownerId: true, status: true } });
    if (l) this.listings.countView(l, u?.id, ip);
  }

  @Auth()
  @Get('me/listings')
  async mine(@CurrentUser() u: AuthUser, @Query(new ZodPipe(mineQuery)) q: z.infer<typeof mineQuery>) {
    // Sahibinin kendi kaldırdığı ilanlar gizlenir; moderatörün kaldırdıkları gerekçesiyle görünür.
    const rows = await this.prisma.listing.findMany({
      where: { ownerId: u.id, ...(q.status ? { status: q.status } : { OR: [{ status: { not: 'removed' } }, { removedReason: { not: null } }] }) },
      include: listingInclude, orderBy: { updatedAt: 'desc' }, take: 200,
    });
    const stats = await this.listings.statsFor(rows);
    return Promise.all(rows.map((l) => this.listings.view(l, u.id, stats.get(l.id))));
  }

  /** Taslak için seviye 1 yeter; onaya göndermek seviye 2 ister (aşağıda, sunucuda). */
  @Auth({ level: 1 })
  @Post('listings')
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(draftSchema)) b: z.infer<typeof draftSchema>) {
    if (b.companyId) await this.assertMember(u.id, b.companyId);
    if (b.boatId) await this.assertOwnBoat(u.id, b.boatId);
    // Yarım kalan taslaklar sınırsız birikmesin (her biri fotoğraf yükleme kapısı).
    if ((await this.prisma.listing.count({ where: { ownerId: u.id, status: 'draft' } })) >= MAX_OPEN_DRAFTS) throw Errors.conflict('TOO_MANY_DRAFTS');
    const l = await this.prisma.listing.create({ data: { ...b, ownerId: u.id, status: 'draft', badges: [] }, include: listingInclude });
    return this.listings.view(l, u.id);
  }

  @Auth({ level: 1 })
  @Patch('listings/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(patchSchema)) b: z.infer<typeof patchSchema>) {
    const l = await this.listings.getOwn(id, u.id);
    if (['sold', 'removed'].includes(l.status)) throw Errors.conflict('LISTING_CLOSED');
    if (b.companyId) await this.assertMember(u.id, b.companyId);
    if (b.boatId) await this.assertOwnBoat(u.id, b.boatId);
    // Yayındaki ya da reddedilmiş ilan düzenlenirse yeniden onaya düşer; ölçülü (yarıdan bir buçuk katına) fiyat
    // değişikliği onay istemez (indirim anında görünsün). Fiyat değişince önceki fiyat geçmişe yazılır; favorileyenler
    // gerçek indirimden haber alır. Haftada en fazla üç fiyat değişikliği.
    const priceChanged = b.price !== undefined && b.price !== l.price;
    const priceOnly = Object.keys(b).every((k) => k === 'price') && !(priceChanged && priceNeedsReview(l.price, b.price!));
    if (priceChanged) {
      const recent = await this.prisma.priceHistory.count({ where: { listingId: id, at: { gt: new Date(Date.now() - 7 * 864e5) } } });
      if (recent >= PRICE_CHANGES_PER_WEEK) throw Errors.tooMany('PRICE_CHANGE_LIMIT');
    }
    const status = priceOnly ? l.status : REVIEWED.includes(l.status) ? 'pending' : l.status;
    // Belge ve ekspertiz rozetleri belirli bir tekne içindir: tekne kimliği değişirse rozetler düşer.
    const identityChanged = IDENTITY_FIELDS.some((k) => b[k] !== undefined && b[k] !== l[k]);
    const badges = identityChanged ? l.badges.filter((x) => !BOAT_BOUND_BADGES.includes(x)) : l.badges;
    await this.prisma.$transaction([
      this.prisma.listing.update({ where: { id }, data: { ...b, status, ...(badges.length !== l.badges.length ? { badges } : {}) } }),
      ...(priceChanged ? [this.prisma.priceHistory.create({ data: { listingId: id, price: l.price, currency: l.currency } })] : []),
    ]);
    await this.audit.log(u.id, 'audit.listingEdited', { fields: Object.keys(b).sort().join(','), status }, 'listing', id);
    const updated = await this.prisma.listing.findUniqueOrThrow({ where: { id }, include: listingInclude });
    if (priceChanged && b.price! < l.price && updated.status === 'published') await this.listings.notifyPriceDrop(updated);
    return this.listings.view(updated, u.id);
  }

  @Auth({ level: 1 })
  @Post('listings/:id/photos')
  async photos(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(photosSchema)) b: z.infer<typeof photosSchema>) {
    const l = await this.listings.getOwn(id, u.id);
    // Satılmış ya da kaldırılmış ilan herkese açık kalabilir; denetimsiz görsel eklenemez.
    if (['sold', 'removed'].includes(l.status)) throw Errors.conflict('LISTING_CLOSED');
    await this.media.assertOwnPublic(u.id, b.fileIds);
    // Sayım ve ekleme aynı işlemde, ilan satırı kilitliyken: eşzamanlı iki istek 20 sınırını aşamaz.
    const added = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id} FOR UPDATE`;
      const current = await tx.listingPhoto.findMany({ where: { listingId: id }, select: { fileId: true } });
      // Zaten ekli fotoğrafların yeniden gönderilmesi (yarıda kalan gönderimin tekrarı) sınıra sayılmaz.
      const fresh = b.fileIds.filter((f) => !current.some((p) => p.fileId === f));
      if (current.length + fresh.length > MAX_PHOTOS) throw Errors.bad('TOO_MANY_PHOTOS', { max: MAX_PHOTOS });
      await tx.listingPhoto.createMany({ data: fresh.map((fileId, i) => ({ listingId: id, fileId, order: current.length + i })) });
      // Onaylanmış içerik denetimsiz değişmesin: yayındaki/reddedilmiş ilana fotoğraf eklenince yeniden onaya düşer.
      if (fresh.length && REVIEWED.includes(l.status)) await tx.listing.update({ where: { id }, data: { status: 'pending' } });
      return fresh.length;
    });
    if (added) await this.audit.log(u.id, 'audit.listingPhotosChanged', { added: String(added) }, 'listing', id);
    return this.listings.view(await this.listings.getOwn(id, u.id), u.id);
  }

  /**
   * Fotoğrafların tam listesi ve sırası (ilk fotoğraf kapak). Listede olmayanlar ilandan çıkar, yeniler eklenir.
   * Yarım kalan gönderimin tekrarı ve düzenleme için: aynı liste ikinci kez gönderilirse hiçbir şey değişmez.
   * Yayındaki ya da reddedilmiş ilanın fotoğrafları değişirse ilan yeniden onaya düşer.
   */
  @Auth({ level: 1 })
  @Put('listings/:id/photos')
  async setPhotos(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(photosSchema)) b: z.infer<typeof photosSchema>) {
    const l = await this.listings.getOwn(id, u.id);
    if (['sold', 'removed'].includes(l.status)) throw Errors.conflict('LISTING_CLOSED');
    if (b.fileIds.length > MAX_PHOTOS) throw Errors.bad('TOO_MANY_PHOTOS', { max: MAX_PHOTOS });
    const current = [...l.photos].sort((a, c) => a.order - c.order).map((p) => p.fileId);
    const fresh = b.fileIds.filter((f) => !current.includes(f));
    // Yalnızca yeni eklenenlerin sahipliği denetlenir; ilandakiler zaten bu ilana aittir.
    if (fresh.length) await this.media.assertOwnPublic(u.id, fresh);
    const changed = current.length !== b.fileIds.length || current.some((f, i) => f !== b.fileIds[i]);
    if (changed) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${id} FOR UPDATE`;
        await tx.listingPhoto.deleteMany({ where: { listingId: id } });
        await tx.listingPhoto.createMany({ data: b.fileIds.map((fileId, order) => ({ listingId: id, fileId, order })) });
        if (REVIEWED.includes(l.status)) await tx.listing.update({ where: { id }, data: { status: 'pending' } });
      });
      await this.audit.log(u.id, 'audit.listingPhotosChanged', { count: String(b.fileIds.length) }, 'listing', id);
    }
    return this.listings.view(await this.listings.getOwn(id, u.id), u.id);
  }

  @Auth({ level: 2 })
  @Post('listings/:id/submit')
  @HttpCode(200)
  async submit(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.listings.getOwn(id, u.id);
    if (!['draft', 'rejected'].includes(l.status)) throw Errors.conflict('LISTING_NOT_DRAFT');
    if (l.photos.length === 0) throw Errors.bad('PHOTO_REQUIRED');
    const updated = await this.prisma.listing.update({ where: { id }, data: { status: 'pending', rejectReason: null }, include: listingInclude });
    await this.audit.log(u.id, 'audit.listingSubmitted', { title: `${l.brand} ${l.model}` }, 'listing', id);
    return this.listings.view(updated, u.id);
  }

  @Auth({ level: 1 })
  @Post('listings/:id/sold')
  @HttpCode(200)
  async sold(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.listings.getOwn(id, u.id);
    if (l.status !== 'published') throw Errors.conflict('LISTING_NOT_PUBLISHED');
    const updated = await this.prisma.listing.update({ where: { id }, data: { status: 'sold' }, include: listingInclude });
    await this.audit.log(u.id, 'audit.listingSold', { title: `${l.brand} ${l.model}` }, 'listing', id);
    return this.listings.view(updated, u.id);
  }

  /** Süresi dolan ya da dolmak üzere olan ilanı 90 gün daha yayında tutar; içerik değişmediği için onaya düşmez. */
  @Auth({ level: 1 })
  @Post('listings/:id/renew')
  @HttpCode(200)
  async renew(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.listings.getOwn(id, u.id);
    if (!canRenew(l)) throw Errors.conflict('NOT_RENEWABLE');
    const updated = await this.prisma.listing.update({
      where: { id }, data: { status: 'published', expiresAt: nextExpiry(), expiryWarnedAt: null }, include: listingInclude,
    });
    await this.audit.log(u.id, 'audit.listingRenewed', { title: `${l.brand} ${l.model}` }, 'listing', id);
    return this.listings.view(updated, u.id);
  }

  @Auth({ level: 1 })
  @Delete('listings/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const l = await this.listings.getOwn(id, u.id);
    await this.prisma.listing.update({ where: { id }, data: { status: 'removed' } });
    await this.audit.log(u.id, 'audit.listingWithdrawn', { title: `${l.brand} ${l.model}`, from: l.status }, 'listing', id);
  }

  @Auth()
  @Put('favorites/:listingId')
  @HttpCode(204)
  async fav(@CurrentUser() u: AuthUser, @Param('listingId') listingId: string) {
    await this.listings.getVisible(listingId, u.id);
    await this.prisma.favorite.upsert({ where: { userId_listingId: { userId: u.id, listingId } }, create: { userId: u.id, listingId }, update: {} });
  }

  @Auth()
  @Delete('favorites/:listingId')
  @HttpCode(204)
  async unfav(@CurrentUser() u: AuthUser, @Param('listingId') listingId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId: u.id, listingId } });
  }

  @Auth()
  @Get('favorites')
  async favorites(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.listing.findMany({
      where: { favorites: { some: { userId: u.id } }, status: { in: ['published', 'sold'] } }, include: listingInclude,
    });
    return Promise.all(rows.map((l) => this.listings.view(l, u.id)));
  }

  private async assertOwnBoat(userId: string, boatId: string) {
    if (!(await this.prisma.boat.count({ where: { id: boatId, ownerId: userId } }))) throw Errors.notFound();
  }

  private async assertMember(userId: string, companyId: string) {
    const m = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
    if (!m) throw Errors.notFound();
  }
}
