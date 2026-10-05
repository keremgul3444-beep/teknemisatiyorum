/** Sunucu hata biçimi `{ code, messageKey, params? }`; ağ hatası `NETWORK` koduyla gelir. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public messageKey: string, public params?: Record<string, unknown>) {
    super(code);
  }
}

export interface TokenStore {
  get(): Promise<{ access: string | null; refresh: string | null }>;
  set(access: string, refresh: string): Promise<void>;
  clear(): Promise<void>;
}

interface Options {
  baseUrl: string;
  fetchFn?: typeof fetch;
  tokens: TokenStore;
  /** Yenileme de başarısız olunca bir kez çağrılır (oturum kapandı). */
  onLoggedOut: () => void;
  /** Sunucu daha yüksek doğrulama seviyesi isteyince çağrılır. */
  onLevelRequired: (level: number) => void;
  /** Uygulama sürümü (`X-App-Version`); sunucu en düşük sürümün altındaysa 426 döner. */
  appVersion?: string;
  /** 426: zorunlu güncelleme (mağaza bağlantılarıyla). */
  onUpgradeRequired?: (p: { min?: string; ios?: string; android?: string }) => void;
}

/** Yalnızca giriş akışının kendi uç noktaları yenilemeye girmez; çıkış ve cihazlar gibi oturum uç noktaları girer. */
const NO_REFRESH = ['/auth/otp', '/auth/verify', '/auth/refresh'];

/**
 * Giriş anahtarını ekleyen istemci. 401'de **bir kez** yenileme dener ve isteği tekrarlar;
 * eşzamanlı 401'ler tek yenileme isteğini paylaşır; yenileme de başarısızsa oturumu kapatır (döngü yok).
 */

export function createApiClient(o: Options) {
  const fetchFn = o.fetchFn ?? fetch;
  let refreshing: Promise<boolean> | null = null;

  async function raw(path: string, init: RequestInit, access: string | null) {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (access) headers.Authorization = `Bearer ${access}`;
    if (o.appVersion) headers['X-App-Version'] = o.appVersion;
    if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    try {
      return await fetchFn(`${o.baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'NETWORK', 'errors.network');
    }
  }

  /**
   * Tek uçuşlu yenileme: eşzamanlı 401'ler aynı sözü paylaşır. Yenileme reddedilirse oturum kapatma da
   * bu sözün içinde bir kez yapılır (toplu isteklerde N kez giriş ekranı açılmaz).
   * Sunucu hatası (5xx) oturumu kapatmaz; yalnızca yenileme anahtarı reddedilirse kapanır.
   */
  async function refreshOrLogout(): Promise<boolean> {
    refreshing ??= (async () => {
      const { refresh: r } = await o.tokens.get();
      if (!r) return false;
      const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: r }) }, null);
      if (res.ok) {
        const body = await res.json();
        await o.tokens.set(body.accessToken, body.refreshToken);
        return true;
      }
      if (res.status === 401 || res.status === 400) {
        await o.tokens.clear();
        o.onLoggedOut();
      }
      return false;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res = await raw(path, init, (await o.tokens.get()).access);
    if (res.status === 401 && !NO_REFRESH.includes(path)) {
      if ((await o.tokens.get()).refresh && await refreshOrLogout()) res = await raw(path, init, (await o.tokens.get()).access);
    }
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.messageKey ?? 'errors.generic', body.params);
      if (e.code === 'LEVEL_REQUIRED') o.onLevelRequired(Number(e.params?.level ?? 1));
      if (res.status === 426) o.onUpgradeRequired?.((e.params ?? {}) as { min?: string; ios?: string; android?: string });
      throw e;
    }
    return body as T;
  }

  const json = (method: string) => <T>(path: string, body?: unknown) =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    get: <T>(path: string) => request<T>(path),
    post: json('POST'),
    patch: json('PATCH'),
    put: json('PUT'),
    del: json('DELETE'),
    upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
    setTokens: (a: string, r: string) => o.tokens.set(a, r),
    logoutLocal: () => o.tokens.clear(),
    hasSession: async () => !!(await o.tokens.get()).refresh,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
