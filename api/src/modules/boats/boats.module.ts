import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { I18N_PREFIX, LogbookService, entryView, parseDateOnly } from './logbook.service';

const boatBody = z.object({
  name: z.string().trim().min(1).max(60),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1900).max(2100),
  lengthM: z.number().positive().max(200),
});
const entryBody = z.object({
  kind: z.enum(['bakim', 'onarim', 'ekspertiz', 'sahiplik']),
  date: z.iso.date(),
  title: z.string().trim().min(1).max(120),
  byName: z.string().trim().min(1).max(80),
});

@Controller('boats')
class BoatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Auth()
  @Get()
  async list(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.boat.findMany({ where: { ownerId: u.id }, include: { entries: { orderBy: { date: 'desc' } } }, orderBy: { createdAt: 'asc' } });
    return rows.map((b) => ({ ...b, entries: b.entries.map(entryView) }));
  }

  @Auth()
  @Post()
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(boatBody)) b: z.infer<typeof boatBody>) {
    const boat = await this.prisma.boat.create({
      data: {
        ...b, ownerId: u.id,
        entries: { create: { kind: 'sahiplik', date: parseDateOnly(new Date().toISOString().slice(0, 10)), title: `${I18N_PREFIX}logbook.boatAdded`, byName: `${I18N_PREFIX}logbook.owner`, verified: false } },
      },
      include: { entries: true },
    });
    return { ...boat, entries: boat.entries.map(entryView) };
  }

  @Auth()
  @Get(':id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const b = await this.prisma.boat.findFirst({ where: { id, ownerId: u.id }, include: { entries: { orderBy: { date: 'desc' } } } });
    if (!b) throw Errors.notFound();
    return { ...b, entries: b.entries.map(entryView) };
  }

  /** Sahibinin kendi eklediği kayıt "beyan"dır (verified=false); doğrulanmış kayıtlar yalnızca platform işlerinden gelir. */
  @Auth()
  @Post(':id/logbook')
  async addEntry(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(entryBody)) e: z.infer<typeof entryBody>) {
    const own = await this.prisma.boat.count({ where: { id, ownerId: u.id } });
    if (!own) throw Errors.notFound();
    const row = await this.prisma.logbookEntry.create({ data: { boatId: id, kind: e.kind, date: parseDateOnly(e.date), title: e.title, byName: e.byName, verified: false } });
    return entryView(row);
  }
}

@Module({ controllers: [BoatsController], providers: [LogbookService], exports: [LogbookService] })
export class BoatsModule {}
