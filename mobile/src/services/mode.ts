import { create } from 'zustand';

/** Sunucu adresi derleme ortamından gelir (`EXPO_PUBLIC_API_URL`); tanımlı değilse uygulama demo modunda açılır. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type Mode = 'demo' | 'api';

/** Demo modu: prototipin sahte verisi (sunum için). Gerçek mod: sunucu. Ayarlar > Demo'dan değiştirilir. */
export const useMode = create<{ mode: Mode; setMode(m: Mode): void }>((set) => ({
  mode: API_URL ? 'api' : 'demo',
  setMode: (mode) => set({ mode: mode === 'api' && !API_URL ? 'demo' : mode }),
}));

export const isApiMode = () => useMode.getState().mode === 'api';
