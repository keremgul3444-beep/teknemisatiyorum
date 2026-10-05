import { create } from 'zustand';

/** Sunucu bu sürümü artık kabul etmiyor (426): uygulama "Güncelle" ekranına kilitlenir. */
export const useUpgrade = create<{ required: boolean; ios?: string; android?: string; require(p: { ios?: string; android?: string }): void }>((set) => ({
  required: false,
  require: (p) => set({ required: true, ios: p.ios || undefined, android: p.android || undefined }),
}));
