import { useSession, levelRedirect } from '@/session/role';

beforeEach(() => useSession.getState().logout());

test('misafir için seviye 1 isteyen işlem girişe yönlenir', () => {
  expect(levelRedirect(1)).toBe('/auth/login');
});

test('giriş yapmış ama kimliksiz kullanıcı kimlik doğrulamaya yönlenir', () => {
  useSession.getState().login();
  expect(levelRedirect(2)).toBe('/verify/identity');
  expect(levelRedirect(1)).toBeNull();
});

test('yeterli seviyede yönlendirme yok', () => {
  useSession.getState().login();
  useSession.getState().setVerifyLevel(2);
  expect(levelRedirect(2)).toBeNull();
});

test('profesyonel seviye eksikse profesyonel doğrulamaya gider', () => {
  useSession.getState().login();
  useSession.getState().setVerifyLevel(2);
  expect(levelRedirect(3)).toBe('/verify/professional');
});
