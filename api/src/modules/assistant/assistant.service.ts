import { Inject, Injectable, Logger } from '@nestjs/common';
import { LOCATIONS, parseQuery, parsedQuerySchema, type ParsedQuery } from '@tms/shared';
import { LLM_CLIENT, type LlmClient } from '../../adapters/llm';
import { CLOCK, type Clock } from '../../common/clock';
import { ListingsService } from '../listings/listings.service';

const LLM_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX = 1000;
const DAILY_LIMIT = { user: 50, guest: 20 };

export type Source = 'llm' | 'rules';

/**
 * Akıllı Asistan: metni önce dil modeliyle, olmazsa kural tabanlı ayrıştırıcıyla filtreye çevirir;
 * sonuçlar her zaman yalnızca veritabanındaki yayındaki ilanlardan gelir.
 * Önbellek ve kota bellek içidir (beta): sunucu yeniden başlayınca sıfırlanır.
 */
@Injectable()
export class AssistantService {
  private readonly log = new Logger('Assistant');
  private readonly cache = new Map<string, { q: ParsedQuery; at: number }>();
  private readonly usage = new Map<string, number>();

  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly listings: ListingsService,
  ) {}

  async search(text: string, who: { userId?: string; ip: string }) {
    const { q, source } = await this.toQuery(text, who);
    const { exact, near } = await this.listings.matchWithNear(q);
    return { query: q, source, exact, near };
  }

  resetUsage() {
    this.usage.clear();
    this.cache.clear();
  }

  private async toQuery(text: string, who: { userId?: string; ip: string }): Promise<{ q: ParsedQuery; source: Source }> {
    const key = text.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
    const now = this.clock.now().getTime();
    const hit = this.cache.get(key);
    if (hit && now - hit.at < CACHE_TTL_MS) return { q: hit.q, source: 'llm' };

    if (!this.takeQuota(who, now)) return { q: parseQuery(text), source: 'rules' };
    try {
      const raw = await this.withTimeout((signal) => this.llm.toFilter(text, { locations: LOCATIONS, signal }));
      const parsed = parsedQuerySchema.safeParse(raw);
      if (!parsed.success) {
        this.log.warn('Dil modeli çıktısı şemaya uymadı; kural tabanlı ayrıştırıcı kullanıldı');
        return { q: parseQuery(text), source: 'rules' };
      }
      this.remember(key, parsed.data, now);
      return { q: parsed.data, source: 'llm' };
    } catch (e) {
      this.log.warn(`Dil modeli kullanılamadı (${e instanceof Error ? e.message : e}); kural tabanlı ayrıştırıcı kullanıldı`);
      return { q: parseQuery(text), source: 'rules' };
    }
  }

  /** Günlük kota: kullanıcı başına 50, misafir IP başına 20 model çağrısı. Aşım aramayı engellemez, yalnızca modeli. */
  private takeQuota(who: { userId?: string; ip: string }, now: number) {
    const day = new Date(now).toISOString().slice(0, 10);
    const id = who.userId ? `u:${who.userId}:${day}` : `ip:${who.ip}:${day}`;
    const used = this.usage.get(id) ?? 0;
    if (used >= (who.userId ? DAILY_LIMIT.user : DAILY_LIMIT.guest)) return false;
    this.usage.set(id, used + 1);
    return true;
  }

  private remember(key: string, q: ParsedQuery, now: number) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { q, at: now });
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const ctrl = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { ctrl.abort(); reject(new Error('zaman aşımı')); }, LLM_TIMEOUT_MS);
    });
    try {
      return await Promise.race([fn(ctrl.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
