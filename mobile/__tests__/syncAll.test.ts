import { ApiError } from '@/services/api/client';

const mockGet = jest.fn();
jest.mock('@/services/api/instance', () => ({ api: { hasSession: async () => true, get: (p: string) => mockGet(p) } }));
import { syncAll } from '@/services/api/sync';

beforeEach(() => mockGet.mockReset());

test('/me ağ hatası sessiz yutulmaz; kullanıcı hata görür', async () => {
  mockGet.mockImplementation(async (p: string) => { if (p === '/me') throw new ApiError(0, 'NETWORK', 'errors.network'); return []; });
  await expect(syncAll()).rejects.toMatchObject({ code: 'NETWORK' });
});

test('/me 401 ise (oturum düşmüş) yükleme misafir olarak sürer', async () => {
  mockGet.mockImplementation(async (p: string) => { if (p === '/me') throw new ApiError(401, 'UNAUTHENTICATED', 'errors.unauthenticated'); if (p.startsWith('/listings')) return { items: [] }; if (p === '/fx') return []; return []; });
  await expect(syncAll()).resolves.toBeUndefined();
});
