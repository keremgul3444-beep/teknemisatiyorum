import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { parsedQuerySchema, type ParsedQuery } from '@tms/shared';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { ListingsService } from './listings.service';

const body = z.object({ text: z.string().trim().min(1).max(300), filter: parsedQuerySchema });

@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly prisma: PrismaService, private readonly listings: ListingsService) {}

  @Auth()
  @Post()
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(body)) b: z.infer<typeof body>) {
    const count = await this.prisma.savedSearch.count({ where: { userId: u.id } });
    if (count >= 20) throw Errors.bad('TOO_MANY_SAVED_SEARCHES', { max: 20 });
    return this.prisma.savedSearch.create({ data: { userId: u.id, text: b.text, filter: b.filter as Prisma.InputJsonValue } });
  }

  /** Her arama için, son bakıştan sonra yayına giren ve filtreye uyan ilan sayısı. */
  @Auth()
  @Get()
  async list(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.savedSearch.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map(async (s) => {
      const filter = parsedQuerySchema.parse(s.filter) as ParsedQuery;
      const { rows: hits } = await this.listings.match(filter, { publishedAt: { gt: s.lastCheckedAt } });
      return { id: s.id, text: s.text, filter, createdAt: s.createdAt, newMatches: hits.length };
    }));
  }

  @Auth()
  @Post(':id/seen')
  @HttpCode(204)
  async seen(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.savedSearch.updateMany({ where: { id, userId: u.id }, data: { lastCheckedAt: new Date() } });
    if (!r.count) throw Errors.notFound();
  }

  @Auth()
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const r = await this.prisma.savedSearch.deleteMany({ where: { id, userId: u.id } });
    if (!r.count) throw Errors.notFound();
  }
}
