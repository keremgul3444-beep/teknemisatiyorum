const mockGet = jest.fn();
jest.mock('@/services/api/instance', () => ({
  api: { hasSession: async () => false, get: (p: string) => mockGet(p), post: async () => undefined, logoutLocal: async () => undefined },
}));
import { actions } from '@/services/actions';
import { useMode } from '@/services/mode';
import { useSession } from '@/session/role';

test('ağ koparken çıkış yapılsa da oturum ekranda kapanır', async () => {
  useMode.setState({ mode: 'api' });
  useSession.setState({ loggedIn: true, userId: 'u1', verifyLevel: 2 });
  mockGet.mockRejectedValue(Object.assign(new Error('ağ'), { status: 0, code: 'NETWORK' }));
  await actions.logout().catch(() => undefined);
  expect(useSession.getState().loggedIn).toBe(false);
  useMode.setState({ mode: 'demo' });
});
