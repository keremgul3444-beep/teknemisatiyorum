import { create } from 'zustand';
import { router } from 'expo-router';
import type { Role } from '@/services/types';

export type VerifyLevel = 0 | 1 | 2 | 3;

interface Session {
  onboarded: boolean; loggedIn: boolean; verifyLevel: VerifyLevel; role: Role; name: string;
  finishOnboarding(): void; login(): void; setVerifyLevel(n: VerifyLevel): void; setRole(r: Role): void; logout(): void;
}

export const useSession = create<Session>((set, get) => ({
  onboarded: false, loggedIn: false, verifyLevel: 0, role: 'bireysel', name: 'Deniz Yılmaz',
  finishOnboarding: () => set({ onboarded: true }),
  login: () => set({ loggedIn: true, verifyLevel: (Math.max(1, get().verifyLevel) as VerifyLevel) }),
  setVerifyLevel: (n) => set({ verifyLevel: n, loggedIn: n > 0 ? true : get().loggedIn }),
  setRole: (role) => set({ role }),
  logout: () => set({ loggedIn: false, verifyLevel: 0, role: 'bireysel' }),
}));

/** Gerekli seviye yoksa gidilecek sayfa; yeterliyse null. */
export function levelRedirect(level: VerifyLevel): string | null {
  const s = useSession.getState();
  if (level >= 1 && !s.loggedIn) return '/auth/login';
  if (level >= 2 && s.verifyLevel < 2) return '/verify/identity';
  if (level >= 3 && s.verifyLevel < 3) return '/verify/professional';
  return null;
}

/** Seviye yetmiyorsa ilgili doğrulama ekranına gönderir ve false döner. */
export function requireLevel(level: VerifyLevel): boolean {
  const to = levelRedirect(level);
  if (to) {
    router.push(to as any);
    return false;
  }
  return true;
}
