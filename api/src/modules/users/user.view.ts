import type { User } from '@prisma/client';

/** Tercihlerin varsayılanları: bildirimler açık, telefon gizli, pazarlama izni yok (açık rıza gerekir). */
export const DEFAULT_PREFS = { notifyMessages: true, notifyMatches: true, notifyMarketing: false, phoneVisible: false, marketingConsent: false };
export type Prefs = typeof DEFAULT_PREFS;
export const prefsOf = (u: Pick<User, 'prefs'>): Prefs => ({ ...DEFAULT_PREFS, ...((u.prefs as Partial<Prefs> | null) ?? {}) });

/**
 * İstemciye dönen kullanıcı görünümü. Şifreli kimlik alanı burada bilerek yoktur;
 * yeni alan eklenirken yalnızca açıkça listelenenler dışarı çıkar.
 */
export function userView(u: User) {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    email: u.email,
    lang: u.lang,
    verifyLevel: u.verifyLevel,
    roles: u.roles,
    nationalIdLast2: u.nationalIdLast2,
    prefs: prefsOf(u),
    createdAt: u.createdAt,
  };
}
export type UserView = ReturnType<typeof userView>;
