import type { User } from '@prisma/client';

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
    createdAt: u.createdAt,
  };
}
export type UserView = ReturnType<typeof userView>;
