import 'server-only';

export const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public messageKey: string) {
    super(code);
  }
}

/** `noCount`: ilan okuması görüntülenme sayılmasın (sayfa önbelleği; gerçek ziyaret tarayıcıdan ayrıca bildirilir). */
type Opts = { token?: string; ip?: string; revalidate?: number | false; noCount?: boolean };

/** Yalnızca sunucuda: API çağrısı. Oturumsuz GET'ler önbelleklenir (`revalidate` sn), diğerleri her seferinde. */
async function call<T>(method: string, path: string, body: unknown, o: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.ip) headers['X-Forwarded-For'] = o.ip;
  if (o.noCount) headers['X-Tms-No-Count'] = '1';
  const cacheable = method === 'GET' && !o.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      ...(cacheable ? { next: { revalidate: o.revalidate ?? 60 } } : { cache: 'no-store' as const }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'errors.network');
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? `HTTP_${res.status}`, json.messageKey ?? 'errors.generic');
  return json as T;
}

export const apiGet = <T,>(path: string, o?: Opts) => call<T>('GET', path, undefined, o);
export const apiSend = <T,>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, o?: Opts) => call<T>(method, path, body, o);
