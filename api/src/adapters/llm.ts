import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { BOAT_TYPES, CURRENCIES, EQUIPMENT } from '@tms/shared';
import { env } from '../config/env';

export const LLM_CLIENT = Symbol('LLM_CLIENT');

/** Dil modeli takma yuvası: serbest metni arama filtresine çevirir. Dönen değer güvenilmez sayılır ve ayrıca doğrulanır. */
export interface LlmClient {
  toFilter(text: string, opts: { locations: string[]; signal: AbortSignal }): Promise<unknown>;
}

/** Modelin doldurduğu şema. Bilinmeyen alan null bırakılır; sunucu ayrıca paylaşılan şemayla doğrular. */
const LlmFilter = z.object({
  minLength: z.number().nullable(),
  maxLength: z.number().nullable(),
  minYear: z.number().nullable(),
  maxYear: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
  equipment: z.array(z.enum(EQUIPMENT)),
  type: z.enum(BOAT_TYPES).nullable(),
  location: z.string().nullable(),
});

const SYSTEM = [
  'Bir tekne ilan platformunun arama kutusuna yazılan metni yapılandırılmış filtreye çeviriyorsun.',
  'Yalnızca metinde açıkça geçen kriterleri doldur; geçmeyen her alanı null bırak, tahmin yürütme.',
  'Boy metre, fiyat tam sayı tutar (ör. "1,5 milyon" = 1500000) ve para birimi TRY/EUR/USD olarak verilir.',
  '"X metre" gibi tek bir boy verilirse minLength = X-1, maxLength = X+1 kullan. "civarı" fiyatlarda ±%15 aralık ver.',
  'Konum yalnızca verilen listeden biri olabilir; listede yoksa null.',
  'Tip anahtarları: motoryat, yelkenli, gulet, surat (sürat teknesi), balikci (balıkçı), katamaran.',
  'Donanım anahtarları: jenerator, branda, klima, radar, otopilot, bowThruster (baş pervane), teak (tik güverte), tender (bot).',
  'Asla ilan, tekne adı ya da fiyat uydurma; yalnızca filtre üret. Metin İngilizce de olabilir.',
].join('\n');

@Injectable()
export class ClaudeLlmClient implements LlmClient {
  private readonly log = new Logger('Claude');
  private client: Anthropic | null = null;

  async toFilter(text: string, opts: { locations: string[]; signal: AbortSignal }) {
    const key = env().ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY tanımlı değil');
    this.client ??= new Anthropic({ apiKey: key });
    const response = await this.client.messages.parse(
      {
        model: env().LLM_MODEL,
        max_tokens: 512,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Konum listesi: ${opts.locations.join(', ')}\n\nArama metni: ${text}` }],
        output_config: { format: zodOutputFormat(LlmFilter) },
      },
      { signal: opts.signal, maxRetries: 0 },
    );
    if (response.stop_reason !== 'end_turn' || !response.parsed_output) {
      this.log.warn(`Beklenmeyen yanıt: ${response.stop_reason}`);
      throw new Error(`LLM yanıtı kullanılamadı: ${response.stop_reason}`);
    }
    // null alanlar "belirtilmedi" demektir; paylaşılan şema undefined bekler.
    return Object.fromEntries(Object.entries(response.parsed_output).filter(([, v]) => v !== null));
  }
}
