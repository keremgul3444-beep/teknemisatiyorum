import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { create } from 'zustand';

/**
 * Sunucu adresi:
 * - `EXPO_PUBLIC_API_URL` verilmişse o kullanılır (ayrı alan adındaki sunucu).
 * - `EXPO_PUBLIC_API_PROXY=1` ise geliştirme sunucusunun kendi adresi + `/api` (metro.config.js proxy'si; tünelde de çalışır).
 * - İkisi de yoksa uygulama demo modunda açılır.
 */
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (process.env.EXPO_PUBLIC_API_PROXY !== '1') return '';
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/api`;
  const host = Constants.expoConfig?.hostUri;
  if (!host) return '';
  const secure = !/^(\d+\.){3}\d+(:\d+)?$|^localhost/.test(host);
  return `${secure ? 'https' : 'http'}://${host}/api`;
}

export const API_URL = resolveApiUrl();
/** Sitenin adresi: ilan paylaşım bağlantıları bu alan adına gider. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://teknemisatiyorum.com').replace(/\/$/, '');

/** Sunucunun döndürdüğü göreli bağlantıyı (ör. /media/…) tam adrese çevirir. */
export const absolute = (url: string) => (url.startsWith('/') ? `${API_URL}${url}` : url);

export type Mode = 'demo' | 'api';

/** Demo modu: prototipin sahte verisi (sunum için). Gerçek mod: sunucu. Ayarlar > Demo'dan değiştirilir. */
export const useMode = create<{ mode: Mode; setMode(m: Mode): void }>((set) => ({
  mode: API_URL ? 'api' : 'demo',
  setMode: (mode) => set({ mode: mode === 'api' && !API_URL ? 'demo' : mode }),
}));

export const isApiMode = () => useMode.getState().mode === 'api';
