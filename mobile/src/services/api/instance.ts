import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { createApiClient, type TokenStore } from './client';
import { API_URL } from '../mode';
import { useSession, levelRedirect } from '@/session/role';
import { useUpgrade } from '@/features/upgrade';

const KEY_A = 'tms.access';
const KEY_R = 'tms.refresh';

/** Anahtarlar telefonda güvenli depoda; web'de yalnızca bellekte (sekme kapanınca silinir). */
function tokenStore(): TokenStore {
  if (Platform.OS === 'web') {
    let mem = { access: null as string | null, refresh: null as string | null };
    return { get: async () => mem, set: async (a, r) => { mem = { access: a, refresh: r }; }, clear: async () => { mem = { access: null, refresh: null }; } };
  }
  return {
    get: async () => ({ access: await SecureStore.getItemAsync(KEY_A), refresh: await SecureStore.getItemAsync(KEY_R) }),
    set: async (a, r) => { await SecureStore.setItemAsync(KEY_A, a); await SecureStore.setItemAsync(KEY_R, r); },
    clear: async () => { await SecureStore.deleteItemAsync(KEY_A); await SecureStore.deleteItemAsync(KEY_R); },
  };
}

export const api = createApiClient({
  baseUrl: API_URL,
  tokens: tokenStore(),
  onLoggedOut: () => {
    useSession.getState().logout();
    router.push('/auth/login');
  },
  onLevelRequired: (level) => {
    const to = levelRedirect(level as 1 | 2 | 3);
    if (to) router.push(to as never);
  },
  appVersion: Constants.expoConfig?.version,
  onUpgradeRequired: (p) => useUpgrade.getState().require(p),
});
