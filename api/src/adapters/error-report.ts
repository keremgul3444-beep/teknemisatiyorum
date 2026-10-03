import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Beklenmeyen hataların hata takip servisine bildirimi (Sentry ya da GlitchTip; ikisi de aynı olay API'sini kullanır).
 * `ERROR_DSN` boşsa hiçbir şey gönderilmez. Kişisel veri gönderilmez: yalnızca hata türü, mesajı (kısaltılmış),
 * yığın izi ve yol kalıbı (`/listings/:id`; gerçek kimlikler ve sorgu dizesi yok). İstek akışını bekletmez.
 */
type Ctx = { route?: string; method?: string; job?: string };
type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown>;

export function parseDsn(dsn: string): { url: string; key: string } | null {
  try {
    const u = new URL(dsn);
    const project = u.pathname.split('/').filter(Boolean).pop();
    if (!u.username || !project) return null;
    const prefix = u.pathname.slice(0, u.pathname.lastIndexOf('/' + project));
    return { url: `${u.protocol}//${u.host}${prefix}/api/${project}/envelope/`, key: u.username };
  } catch {
    return null;
  }
}

/** V8 yığın izini Sentry çerçevelerine çevirir (en eski çağrı başta). */
export function frames(stack: string | undefined) {
  const out: { function?: string; filename: string; lineno: number; colno: number; in_app: boolean }[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!m) continue;
    out.push({ function: m[1], filename: m[2], lineno: Number(m[3]), colno: Number(m[4]), in_app: !m[2].includes('node_modules') && !m[2].startsWith('node:') });
  }
  return out.reverse();
}

export function buildEvent(err: unknown, ctx: Ctx = {}) {
  const e = err instanceof Error ? err : new Error(String(err));
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) if (v) tags[k] = String(v).slice(0, 200);
  return {
    event_id: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: process.env.NODE_ENV ?? 'unknown',
    ...(process.env.RELEASE ? { release: process.env.RELEASE } : {}),
    tags,
    exception: { values: [{ type: e.name || 'Error', value: e.message.slice(0, 500), stacktrace: { frames: frames(e.stack) } }] },
  };
}

/** Hata fırtınasında servisi boğmamak için dakikada en çok bu kadar bildirim. */
export const REPORTS_PER_MINUTE = 30;
let window = { start: 0, count: 0 };

export function reportError(err: unknown, ctx: Ctx = {}, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<boolean> {
  // Hata bildirimi asla yeni hata üretmez: ayarlar okunamazsa (ör. açılışta eksik ayar) sessizce vazgeçilir.
  let dsn: ReturnType<typeof parseDsn> = null;
  try { dsn = parseDsn(env().ERROR_DSN); } catch { return Promise.resolve(false); }
  if (!dsn) return Promise.resolve(false);
  const now = Date.now();
  if (now - window.start > 60_000) window = { start: now, count: 0 };
  if (++window.count > REPORTS_PER_MINUTE) return Promise.resolve(false);
  const ev = buildEvent(err, ctx);
  const body = [JSON.stringify({ event_id: ev.event_id, sent_at: new Date(now).toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(ev)].join('\n') + '\n';
  return fetchImpl(dsn.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=tms-api/1.0` },
    body,
  }).then(() => true, () => false);
}

/** Testler için: dakikalık sayacı sıfırlar. */
export function resetReportWindow() {
  window = { start: 0, count: 0 };
}
