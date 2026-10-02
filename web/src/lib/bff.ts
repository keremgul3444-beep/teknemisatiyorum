import { NextResponse } from 'next/server';
import { API_URL } from './api';
import { sameOrigin } from './security';
import { ACCESS_COOKIE, clientIp, cookieValue, jwtExpired, REFRESH_COOKIE, refreshTokens, setSession } from './session';

export const forbidden = () => NextResponse.json({ code: 'FORBIDDEN_ORIGIN', messageKey: 'errors.forbidden' }, { status: 403 });
const json = (code: string, messageKey: string, status: number) => NextResponse.json({ code, messageKey }, { status });

type Tokens = { accessToken: string; refreshToken: string };
type Relayed = { res: NextResponse; ok?: never; fresh?: Tokens } | { ok: Record<string, unknown>; res?: never; fresh?: Tokens };

/**
 * Tarayıcı isteğini API'ye aktarır: Origin denetimi (başka siteden sahte istek yok), ziyaretçi IP'si
 * (giriş kodu sınırları kişi başına işlesin) ve istenirse HttpOnly çerezdeki oturum anahtarı.
 */
export async function relay(
  req: Request, path: string, body: unknown,
  o: { auth?: boolean; method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; token?: string } = {},
): Promise<Relayed> {
  // GET yalnızca okur; diğer yöntemler başka siteden tetiklenemesin diye Origin denetlenir.
  if ((o.method ?? 'POST') !== 'GET' && !sameOrigin(req)) return { res: forbidden() };
  // Aynı istekte ikinci API çağrısı: ilk çağrıda yenilenen anahtar doğrudan verilir.
  let token = o.auth ? o.token ?? cookieValue(req, ACCESS_COOKIE) : undefined;
  let fresh: Tokens | undefined;
  // Erişim anahtarı yok ya da dolmuş: yenileme anahtarıyla sessizce yenile (sayfada uzun kalan kullanıcı).
  if (o.auth && !o.token && (!token || jwtExpired(token))) {
    const rt = cookieValue(req, REFRESH_COOKIE);
    fresh = (rt && (await refreshTokens(API_URL, rt))) || undefined;
    token = fresh?.accessToken;
  }
  if (o.auth && !token) return { res: json('UNAUTHENTICATED', 'errors.unauthenticated', 401) };
  const r = await fetch(`${API_URL}${path}`, {
    method: o.method ?? 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientIp(req), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!r) return { res: withFresh(json('NETWORK', 'errors.network', 502), fresh), fresh };
  const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) return { res: withFresh(json(data.code ?? `HTTP_${r.status}`, data.messageKey ?? 'errors.generic', r.status), fresh), fresh };
  return { ok: data as Record<string, unknown>, fresh };
}

/** Gövdeyi güvenle oku (bozuk JSON boş nesne). */
export const readJson = async (req: Request): Promise<Record<string, unknown>> => (await req.clone().json().catch(() => ({}))) ?? {};

/** Yenilenmiş anahtar varsa yanıta çerez olarak yazar (rota işleyicileri başarı yanıtında da çağırır). */
export function withFresh<T extends NextResponse>(res: T, fresh?: Tokens): T {
  if (fresh) setSession(res, fresh);
  return res;
}
