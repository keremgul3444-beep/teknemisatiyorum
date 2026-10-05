import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { env } from '../../config/env';
import { LISTING_WRITER, rulesDescription, type ListingFacts, type ListingWriter } from '../../adapters/listing-writer';

/** Kullanıcı başına günlük açıklama taslağı (modelle); aşılınca kural tabanlı taslak döner. */
export const DESCRIBE_PER_DAY = 20;
const TIMEOUT_MS = 20_000;

/**
 * İlan metinleri: sihirbazda açıklama taslağı ve onaylanan ilanın İngilizce açıklaması. Anahtar yoksa ya da model
 * yanıt vermezse taslak kural tabanlıdır, çeviri yapılmaz (site Türkçe açıklamayı gösterir).
 */
@Injectable()
export class ListingTexts {
  private readonly log = new Logger('ListingTexts');
  private usage = new Map<string, number>();
  private day = '';

  constructor(private readonly prisma: PrismaService, @Inject(LISTING_WRITER) private readonly writer: ListingWriter) {}

  async describe(userId: string, facts: ListingFacts): Promise<{ text: string; source: 'llm' | 'rules' }> {
    if (!env().ANTHROPIC_API_KEY || !this.take(userId)) return { text: rulesDescription(facts), source: 'rules' };
    try {
      return { text: await this.withTimeout((s) => this.writer.describe(facts, s)), source: 'llm' };
    } catch (e) {
      this.log.warn(`Açıklama taslağı modelle yazılamadı (${e instanceof Error ? e.message : e}); kural tabanlı`);
      return { text: rulesDescription(facts), source: 'rules' };
    }
  }

  /** Onaylanan ilanın açıklamasını çevirir; bu arada açıklama değiştiyse yazmaz. Başarısızlık ilanı etkilemez. */
  async translateListing(listingId: string) {
    if (!env().ANTHROPIC_API_KEY) return false;
    const l = await this.prisma.listing.findUnique({ where: { id: listingId }, select: { description: true, descriptionEn: true, status: true } });
    if (!l || l.status !== 'published' || !l.description.trim() || l.descriptionEn) return false;
    const en = await this.withTimeout((s) => this.writer.translate(l.description, s));
    const r = await this.prisma.listing.updateMany({ where: { id: listingId, description: l.description }, data: { descriptionEn: en } });
    return r.count > 0;
  }

  resetUsage() {
    this.usage.clear();
  }

  private take(userId: string) {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) { this.usage.clear(); this.day = day; }
    const used = this.usage.get(userId) ?? 0;
    if (used >= DESCRIBE_PER_DAY) return false;
    this.usage.set(userId, used + 1);
    return true;
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fn(ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
  }
}
