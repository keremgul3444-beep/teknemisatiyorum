import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../../common/decorators';
import { ZodPipe } from '../../../common/zod.pipe';
import { PrismaService } from '../../../common/prisma.service';
import { AppError, Errors } from '../../../common/errors';
import { draftSchema } from '../../listings/listings.controller';
import { parseCsv } from './csv';
import { mapHeader, MAX_IMPORT_ROWS, toImportRow, TEMPLATE_CSV, type ImportRow, type RowError } from './rows';
import { ImportRunner } from './import.service';

/** Firma başına günde en fazla bu kadar toplu yükleme. */
const IMPORTS_PER_DAY = 5;
const body = z.object({ csv: z.string().min(1).max(900_000) });

@Controller('companies/:id/imports')
export class ImportController {
  constructor(private readonly prisma: PrismaService, private readonly runner: ImportRunner) {}

  /** Örnek dosya (Excel'de açılır, `;` ayraçlı). */
  @Auth()
  @Get('template')
  template() {
    return { filename: 'toplu-ilan-sablonu.csv', csv: TEMPLATE_CSV };
  }

  /** Önizleme: hiçbir şey oluşturmaz; geçerli satır sayısı ve satır hataları. */
  @Auth({ level: 2 })
  @Post('preview')
  async preview(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(body)) b: z.infer<typeof body>) {
    await this.assertMember(u.id, id);
    const { rows, errors, missing } = this.read(b.csv, id);
    return { valid: rows.length, errors, missing, sample: rows.slice(0, 5).map((r) => ({ row: r.row, ...r.draft, photos: r.photos.length })) };
  }

  /** Yüklemeyi başlatır: geçerli satırlar arka planda işlenir; hatalı satırlar atlanır ve raporlanır. */
  @Auth({ level: 2 })
  @Post()
  async start(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(body)) b: z.infer<typeof body>) {
    await this.assertMember(u.id, id);
    const { rows, errors, missing } = this.read(b.csv, id);
    if (missing.length) throw new AppError('IMPORT_COLUMNS', 'errors.import_columns', 400, { missing: missing.join(', ') });
    if (!rows.length) throw new AppError('IMPORT_EMPTY', 'errors.import_empty', 400);
    if (await this.prisma.importJob.count({ where: { companyId: id, status: { in: ['queued', 'running'] } } })) throw new AppError('IMPORT_RUNNING', 'errors.import_running', 409);
    const today = await this.prisma.importJob.count({ where: { companyId: id, createdAt: { gt: new Date(Date.now() - 864e5) } } });
    if (today >= IMPORTS_PER_DAY) throw Errors.tooMany('IMPORT_LIMIT');
    const job = await this.prisma.importJob.create({
      data: {
        companyId: id, userId: u.id, total: rows.length + new Set(errors.map((e) => e.row)).size, input: rows as unknown as Prisma.InputJsonValue,
        results: [...new Set(errors.map((e) => e.row))].map((row) => ({ row, ok: false, error: errors.filter((e) => e.row === row).map((e) => `${e.field}:${e.code}`).join(',') })) as unknown as Prisma.InputJsonValue,
      },
    });
    void this.runner.enqueue(job.id);
    return this.view(job);
  }

  @Auth()
  @Get()
  async list(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.assertMember(u.id, id);
    const jobs = await this.prisma.importJob.findMany({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, take: 10 });
    return jobs.map((j) => this.view(j));
  }

  @Auth()
  @Get(':jobId')
  async one(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('jobId') jobId: string) {
    await this.assertMember(u.id, id);
    const j = await this.prisma.importJob.findFirst({ where: { id: jobId, companyId: id } });
    if (!j) throw Errors.notFound();
    return this.view(j);
  }

  private view(j: { id: string; status: string; total: number; created: number; results: unknown; createdAt: Date; finishedAt: Date | null }) {
    const results = (j.results as { row: number; ok: boolean; listingId?: string; error?: string }[]).sort((a, b) => a.row - b.row);
    return { id: j.id, status: j.status, total: j.total, created: j.created, processed: results.length, failed: results.filter((r) => !r.ok), createdAt: j.createdAt, finishedAt: j.finishedAt };
  }

  /** Dosyayı okur: başlık eşlemesi, satır çevirisi ve sunucu şemasıyla son doğrulama (satır numarası Excel'deki gibi). */
  private read(csv: string, companyId: string) {
    const table = parseCsv(csv);
    const errors: RowError[] = [];
    const rows: ImportRow[] = [];
    if (table.length < 2) return { rows, errors, missing: table.length ? [] : ['header'] };
    const { index, missing } = mapHeader(table[0]);
    if (missing.length) return { rows, errors, missing };
    const data = table.slice(1);
    if (data.length > MAX_IMPORT_ROWS) throw new AppError('IMPORT_TOO_MANY', 'errors.import_too_many', 400, { max: MAX_IMPORT_ROWS });
    data.forEach((cells, i) => {
      const r = toImportRow(cells, index, i + 2);
      if ('errors' in r) { errors.push(...r.errors); return; }
      const parsed = draftSchema.safeParse({ ...r.ok.draft, companyId });
      if (!parsed.success) { parsed.error.issues.forEach((x) => errors.push({ row: r.ok.row, field: String(x.path[0] ?? 'row'), code: 'invalid' })); return; }
      rows.push(r.ok);
    });
    return { rows, errors, missing };
  }

  /** Toplu yükleme firma sahibine, yöneticisine ve personeline açık; başkası için firma yokmuş gibi (404). */
  private async assertMember(userId: string, companyId: string) {
    const m = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
    if (!m) throw Errors.notFound();
  }
}
