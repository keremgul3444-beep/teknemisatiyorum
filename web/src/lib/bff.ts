import { NextResponse } from 'next/server';
import { API_URL } from './api';
import { sameOrigin } from './security';
import { ACCESS_COOKIE, clientIp, cookieValue } from './session';

export const forbidden = () => NextResponse.json({ code: 'FORBIDDEN_ORIGIN', messageKey: 'errors.forbidden' }, { status: 403 });
const json = (code: string, messageKey: string, status: number) => NextResponse.json({ code, messageKey }, { status });

type Relayed = { res: NextResponse; ok?: never } | { ok: Record<string, unknown>; res?: never };

/**
 * Tarayıcı isteğini API'ye aktarır: Origin denetimi (başka siteden sahte istek yok), ziyaretçi IP'si
 * (giriş kodu sınırları kişi başına işlesin) ve istenirse HttpOnly çerezdeki oturum anahtarı.
 */
export async function relay(req: Request, path: string, body: unknown, o: { auth?: boolean } = {}): Promise<Relayed> {
  if (!sameOrigin(req)) return { res: forbidden() };
  const token = o.auth ? cookieValue(req, ACCESS_COOKIE) : undefined;
  if (o.auth && !token) return { res: json('UNAUTHENTICATED', 'errors.unauthenticated', 401) };
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp(req), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!r) return { res: json('NETWORK', 'errors.network', 502) };
  const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) return { res: json(data.code ?? `HTTP_${r.status}`, data.messageKey ?? 'errors.generic', r.status) };
  return { ok: data as Record<string, unknown> };
}

/** Gövdeyi güvenle oku (bozuk JSON boş nesne). */
export const readJson = async (req: Request): Promise<Record<string, unknown>> => (await req.clone().json().catch(() => ({}))) ?? {};
