// Gerçek Claude API anahtarıyla tek bir asistan sorgusu dener (elle çalıştırılır, testlere dahil değildir).
// Kullanım: node --env-file=.env --import tsx scripts/llm-smoke.ts "12 metreye kadar jeneratörlü 2015 sonrası"
import 'reflect-metadata';
import { LOCATIONS, parsedQuerySchema } from '@tms/shared';
import { ClaudeLlmClient } from '../src/adapters/llm';

(async () => {
  const text = process.argv.slice(2).join(' ') || '12 metreye kadar jeneratörlü brandalı 2015 sonrası';
  const started = Date.now();
  const raw = await new ClaudeLlmClient().toFilter(text, { locations: LOCATIONS, signal: AbortSignal.timeout(15000) });
  const parsed = parsedQuerySchema.safeParse(raw);
  console.log(JSON.stringify({ text, ms: Date.now() - started, raw, valid: parsed.success }, null, 2));
  process.exit(parsed.success ? 0 : 1);
})().catch((e) => { console.error('Hata:', e instanceof Error ? e.message : e); process.exit(1); });
