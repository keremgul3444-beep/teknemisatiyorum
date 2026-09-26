import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { failures, type BoatType, type Equipment, type ParsedQuery, type Criterion } from '@tms/shared';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { FxService } from './fx.service';
import { listingInclude, listingView, type ListingRow } from './listing.view';

export const MAX_PHOTOS = 20;
export type Sort = 'new' | 'asc' | 'desc';

const asMatchable = (l: ListingRow) => ({ ...l, type: l.type as BoatType, equipment: l.equipment as Equipment[] });

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService, private readonly fx: FxService) {}

  /** Sahibi değilse yalnızca yayındaki (ve satılmış) ilanlar görünür; aksi halde 404 (varlığı da sızdırılmaz). */
  async getVisible(id: string, viewerId?: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: listingInclude });
    if (!l || (l.ownerId !== viewerId && !['published', 'sold'].includes(l.status))) throw Errors.notFound();
    return l;
  }

  async getOwn(id: string, userId: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: listingInclude });
    if (!l || l.ownerId !== userId) throw Errors.notFound();
    return l;
  }

  async view(l: ListingRow, viewerId?: string) {
    const company = l.companyId ? await this.prisma.company.findUnique({ where: { id: l.companyId } }) : null;
    return listingView(l, viewerId, company?.name);
  }

  /** Veritabanında kaba süzme + fiyat/donanım için ortak `failures` kuralı (kur tablosuyla). */
  async match(q: ParsedQuery, extraWhere: Prisma.ListingWhereInput = {}) {
    const where: Prisma.ListingWhereInput = {
      ...extraWhere,
      status: 'published',
      ...(q.type ? { type: q.type } : {}),
      ...(q.location ? { location: q.location } : {}),
      ...(q.minYear !== undefined || q.maxYear !== undefined ? { year: { gte: q.minYear, lte: q.maxYear } } : {}),
      ...(q.minLength !== undefined || q.maxLength !== undefined ? { lengthM: { gte: q.minLength, lte: q.maxLength } } : {}),
    };
    // Beta ölçeği için fiyat süzmesi bellekte; ilan sayısı birkaç bini aşınca kurla çarpılmış fiyat sütununa (SQL) taşınmalı.
    const rows = await this.prisma.listing.findMany({ where, include: listingInclude, orderBy: { year: 'desc' } });
    const rates = await this.fx.rates();
    return { rows: rows.filter((l) => failures(asMatchable(l), q, rates).length === 0), rates };
  }

  /** Asistan için: tam eşleşenler + tek kriteri eksik yakın sonuçlar (yayındaki tüm ilanlar üzerinde). */
  async matchWithNear(q: ParsedQuery, limitNear = 5) {
    const rates = await this.fx.rates();
    const rows = await this.prisma.listing.findMany({ where: { status: 'published' }, include: listingInclude, orderBy: { year: 'desc' } });
    const exact: ListingRow[] = [];
    const near: { listing: ListingRow; missing: Criterion[] }[] = [];
    for (const l of rows) {
      const f = failures(asMatchable(l), q, rates);
      if (f.length === 0) exact.push(l);
      else if (f.length === 1 && near.length < limitNear) near.push({ listing: l, missing: f });
    }
    return { exact, near, rates };
  }

  async search(q: ParsedQuery, sort: Sort, page: number, pageSize = 20) {
    const { rows, rates } = await this.match(q);
    const tl = (l: ListingRow) => l.price * rates[l.currency];
    if (sort !== 'new') rows.sort((a, b) => (sort === 'asc' ? tl(a) - tl(b) : tl(b) - tl(a)));
    else rows.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }
}
