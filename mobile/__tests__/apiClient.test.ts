import { createApiClient, ApiError, type TokenStore } from '@/services/api/client';

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown };

function setup(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return { ok: r.status < 300, status: r.status, json: async () => r.body ?? {}, text: async () => JSON.stringify(r.body ?? {}) } as Response;
  });
  let tokens: { access: string | null; refresh: string | null } = { access: 'A1', refresh: 'R1' };
  const store: TokenStore = {
    get: async () => tokens,
    set: async (a, r) => { tokens = { access: a, refresh: r }; },
    clear: async () => { tokens = { access: null, refresh: null }; },
  };
  const onLoggedOut = jest.fn();
  const onLevelRequired = jest.fn();
  const api = createApiClient({ baseUrl: 'http://api', fetchFn: fetchFn as unknown as typeof fetch, tokens: store, onLoggedOut, onLevelRequired });
  return { api, calls, onLoggedOut, onLevelRequired, getTokens: () => tokens };
}

const auth = (init: RequestInit) => (init.headers as Record<string, string>).Authorization;

test('401 → bir kez yenile → isteği yeni anahtarla tekrarla', async () => {
  const { api, calls, getTokens } = setup((url, init) => {
    if (url.endsWith('/auth/refresh')) return { status: 200, body: { accessToken: 'A2', refreshToken: 'R2' } };
    return auth(init) === 'Bearer A2' ? { status: 200, body: { ok: 1 } } : { status: 401, body: { code: 'UNAUTHENTICATED' } };
  });
  await expect(api.get('/me')).resolves.toEqual({ ok: 1 });
  expect(calls.map((c) => c.url)).toEqual(['http://api/me', 'http://api/auth/refresh', 'http://api/me']);
  expect(getTokens()).toEqual({ access: 'A2', refresh: 'R2' });
});

test('yenileme de 401 → tek çıkış, döngü yok', async () => {
  const { api, calls, onLoggedOut, getTokens } = setup(() => ({ status: 401, body: { code: 'UNAUTHENTICATED' } }));
  await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError);
  expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  expect(calls).toHaveLength(2);
  expect(onLoggedOut).toHaveBeenCalledTimes(1);
  expect(getTokens()).toEqual({ access: null, refresh: null });
});

test('eşzamanlı iki 401 → tek yenileme isteği', async () => {
  let refreshed = false;
  const { api, calls } = setup((url, init) => {
    if (url.endsWith('/auth/refresh')) { refreshed = true; return { status: 200, body: { accessToken: 'A2', refreshToken: 'R2' } }; }
    return refreshed && auth(init) === 'Bearer A2' ? { status: 200, body: {} } : { status: 401 };
  });
  await Promise.all([api.get('/a'), api.get('/b')]);
  expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
});

test('LEVEL_REQUIRED → yönlendirme çağrılır ve hata fırlatılır', async () => {
  const { api, onLevelRequired } = setup(() => ({ status: 403, body: { code: 'LEVEL_REQUIRED', messageKey: 'errors.levelRequired', params: { level: 2 } } }));
  await expect(api.post('/listings/x/submit')).rejects.toMatchObject({ code: 'LEVEL_REQUIRED', status: 403 });
  expect(onLevelRequired).toHaveBeenCalledWith(2);
});

test('giriş anahtarı yoksa Authorization başlığı gönderilmez', async () => {
  const { api, calls } = setup(() => ({ status: 200, body: [] }));
  await api.logoutLocal();
  await api.get('/listings');
  expect(auth(calls[0].init)).toBeUndefined();
});

test('ağ hatası anlaşılır hataya çevrilir', async () => {
  const { api } = setup(() => { throw new TypeError('Network request failed'); });
  await expect(api.get('/x')).rejects.toMatchObject({ code: 'NETWORK' });
});
