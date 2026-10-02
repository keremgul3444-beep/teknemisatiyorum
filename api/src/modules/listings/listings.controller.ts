import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { BOAT_TYPES, CURRENCIES, EQUIPMENT, normalizeLocation, parsedQuerySchema } from '@tms/shared';
import { Auth, CurrentUser, OptionalUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { Errors } from '../../common/errors';
import { MediaService } from '../media/media.service';
import { ListingsService, MAX_PHOTOS } from './listings.service';
import { listingInclude, type ListingRow } from './listing.view';

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
  companyId: z.string().optional(),
  boatId: z.string().optional(),
});
const patchSchema = draftSchema.partial();
const photosSchema = z.object({ fileIds: z.array(z.string().min(1)).min(1).transform((a) => [...new Set(a)]) });
const mineQuery = z.object({ status: z.enum(['draft', 'pending', 'published', 'rejected', 'sold', 'removed']).optional() });
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
    const { rows, total, featuredTop } = await this.listings.search(q.q, q.sort, q.page, { urgentOnly: q.urgent === '1' });
    const view = (l: ListingRow) => this.listings.view(l, u?.id);
    return { items: await Promise.all(rows.map(view)), total, featuredTop: await Promise.all(featuredTop.map(view)) };
  }

  // Sabit yollar `listings/:id`'den önce tanımlanır (yoksa "showcase" bir ilan kimliği sanılır).
  @Public()
  @Get('listings/showcase')
  async showcase(@OptionalUser() u: AuthUser | undefined) {
    const s = await this.listings.showcase();
    const view = (l: ListingRow) => this.listings.view(l, u?.id);
    return { featured: await Promise.all(s.featured.map(view)), urgent: await Promise.all(s.urgent.map(view)) };
  }

  @Public()
  @Get('listings/sitemap')
  sitemap() {
    return this.listings.sitemap();
  }

  @Public()
  @Get('listings/:id')
  async get(@OptionalUser() u: AuthUser | undefined, @Param('id') id: string) {
    const staff = !!u?.roles.some((r) => r === 'admin' || r === 'moderator');
    return this.listings.view(await this.listings.getVisible(id, u?.id, staff), u?.id);
  }

  @Auth()
  @Get('me/listings')
  async mine(@CurrentUser() u: AuthUser, @Query(new ZodPipe(mineQuery)) q: z.infer<typeof mineQuery>) {
    const rows = await this.prisma.listing.findMany({
      where: { ownerId: u.id, status: q.status ?? { not: 'removed' } },
      include: listingInclude, orderBy: { updatedAt: 'desc' }, take: 200,
    });
    return Promise.all(rows.map((l) => this.listings.view(l, u.id)));
  }

  /** Taslak için seviye 1 yeter; onaya göndermek seviye 2 ister (aşağıda, sunucuda). */
  @Auth({ level: 1 })
  @Post('listings')
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(draftSchema)) b: z.infer<typeof draftSchema>) {
    if (b.companyId) await this.assertMember(u.id, b.companyId);
    if (b.boatId) await this.assertOwnBoat(u.id, b.boatId);
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
    // Yayındaki ya da reddedilmiş ilan düzenlenirse yeniden onaya düşer.
    const status = l.status === 'published' || l.status === 'rejected' ? 'pending' : l.status;
    const updated = await this.prisma.listing.update({ where: { id }, data: { ...b, status }, include: listingInclude });
    return this.listings.view(updated, u.id);
  }

  @Auth({ level: 1 })
  @Post('listings/:id/photos')
  async photos(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(photosSchema)) b: z.infer<typeof photosSchema>) {
    const l = await this.listings.getOwn(id, u.id);
    await this.media.assertOwnPublic(u.id, b.fileIds);
    // Zaten ekli fotoğrafların yeniden gönderilmesi (yarıda kalan gönderimin tekrarı) sınıra sayılmaz.
    const fresh = b.fileIds.filter((f) => !l.photos.some((p) => p.fileId === f));
    if (l.photos.length + fresh.length > MAX_PHOTOS) throw Errors.bad('TOO_MANY_PHOTOS', { max: MAX_PHOTOS });
    await this.prisma.listingPhoto.createMany({ data: fresh.map((fileId, i) => ({ listingId: id, fileId, order: l.photos.length + i })) });
    // Onaylanmış içerik denetimsiz değişmesin: yayındaki/reddedilmiş ilana fotoğraf eklenince yeniden onaya düşer.
    if (fresh.length && (l.status === 'published' || l.status === 'rejected')) await this.prisma.listing.update({ where: { id }, data: { status: 'pending' } });
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
    return this.listings.view(await this.prisma.listing.update({ where: { id }, data: { status: 'sold' }, include: listingInclude }), u.id);
  }

  @Auth({ level: 1 })
  @Delete('listings/:id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.listings.getOwn(id, u.id);
    await this.prisma.listing.update({ where: { id }, data: { status: 'removed' } });
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
