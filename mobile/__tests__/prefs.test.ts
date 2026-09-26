import { applyUser } from '@/services/api/sync';
import { useSession } from '@/session/role';

test('sunucudaki tercihler oturuma yazılır', () => {
  applyUser({ id: 'u1', phone: null, name: 'A', email: null, lang: 'tr', verifyLevel: 1, roles: ['user'], nationalIdLast2: null,
    prefs: { notifyMessages: false, notifyMatches: true, notifyMarketing: false, phoneVisible: true, marketingConsent: false } });
  expect(useSession.getState().prefs).toMatchObject({ notifyMessages: false, phoneVisible: true });
});
