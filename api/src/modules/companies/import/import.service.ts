import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { AuditService } from '../../../common/audit.service';
import { IMAGE_FETCHER, ImageFetchError, type ImageFetcher } from '../../../adapters/image-fetch';
import { reportError } from '../../../adapters/error-report';
import { MediaService } from '../../media/media.service';
import { draftSchema } from '../../listings/listings.controller';
import type { ImportRow } from './rows';
import { NotificationsService } from '../../notifications/notifications.module';

export type RowResult = { row: number; ok: boolean; listingId?: string; error?: string };

/**
 * Toplu yükleme işleyicisi: işler sırayla, arka planda yürür (istek beklemez). Her satırda fotoğraflar indirilir,
 * yüklenir (EXIF atılır, küçültülür), ilan firma adına oluşturulup onaya gönderilir. Bir fotoğraf inmezse o satır
 * atlanır; diğer satırlar sürer. Sunucu yeniden başlarsa yarım kalan işler açılışta sürdürülür.
 */
@Injectable()
export class ImportRunner implements OnApplicationBootstrap {
  private readonly log = new Logger('Import');
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(IMAGE_FETCHER) private readonly fetchImage: ImageFetcher,
  ) {}

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    const open = await this.prisma.importJob.findMany({ where: { status: { in: ['queued', 'running'] } }, select: { id: true } }).catch(() => []);
    open.forEach((j) => this.enqueue(j.id));
  }

  enqueue(jobId: string) {
    this.chain = this.chain.then(() => this.run(jobId)).catch((e) => {
      this.log.error(`Toplu yükleme yapılamadı: ${e}`);
      void reportError(e, { job: 'import' });
    });
    return this.chain;
  }

  /** Testler için: kuyruk boşalana kadar bekler. */
  idle() {
    return this.chain;
  }

  private async run(jobId: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'done' || job.status === 'failed') return;
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'running' } });
    const rows = job.input as unknown as ImportRow[];
    const results = [...((job.results as unknown as RowResult[]) ?? [])];
    let created = job.created;
    for (const r of rows) {
      if (results.some((x) => x.row === r.row)) continue; // yeniden başlatmada işlenmiş satır atlanır
      const res = await this.row(job.userId, job.companyId, r).catch((e): RowResult => ({ row: r.row, ok: false, error: e instanceof ImageFetchError ? `photo:${e.code}` : 'internal' }));
      results.push(res);
      if (res.ok) created++;
      await this.prisma.importJob.update({ where: { id: jobId }, data: { results: results as unknown as Prisma.InputJsonValue, created } });
    }
    await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'done', finishedAt: new Date() } });
    await this.audit.log(job.userId, 'audit.listingsImported', { created: String(created), total: String(job.total) }, 'company', job.companyId);
    await this.notifications.push(job.userId, 'notif.importDone', { created: String(created), total: String(job.total), companyId: job.companyId });
  }

  private async row(userId: string, companyId: string, r: ImportRow): Promise<RowResult> {
    const parsed = draftSchema.safeParse({ ...r.draft, companyId });
    if (!parsed.success) return { row: r.row, ok: false, error: `field:${parsed.error.issues[0]?.path.join('.') || 'row'}` };
    // Üye hâlâ firmada mı ve hesap açık mı (iş kuyrukta beklerken çıkarılmış olabilir).
    const member = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, suspendedAt: true } });
    if (!member || !user || user.deletedAt || user.suspendedAt) return { row: r.row, ok: false, error: 'notMember' };
    const fileIds: string[] = [];
    for (const url of r.photos) {
      const buf = await this.fetchImage(url);
      const f = await this.media.upload(userId, buf, 'public', { bulk: true }).catch(() => { throw new ImageFetchError('type'); });
      fileIds.push(f.id);
    }
    const { companyId: _c, boatId: _b, ...data } = parsed.data;
    const l = await this.prisma.listing.create({
      data: { ...data, ownerId: userId, companyId, status: 'pending', badges: [], photos: { create: fileIds.map((fileId, order) => ({ fileId, order })) } },
    });
    await this.audit.log(userId, 'audit.listingSubmitted', { title: `${l.brand} ${l.model}`, via: 'import' }, 'listing', l.id);
    return { row: r.row, ok: true, listingId: l.id };
  }
}
