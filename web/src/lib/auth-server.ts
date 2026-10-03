import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { localePath, type Locale } from '@/i18n';
import { ApiError, apiGet } from './api';
import { ACCESS_COOKIE, FRESH_TOKEN_HEADER } from './session';

/** Geçerli oturum anahtarı: ara katman bu istekte yenilediyse başlıktan, değilse çerezden. */
export async function currentToken(): Promise<string | undefined> {
  return (await headers()).get(FRESH_TOKEN_HEADER) ?? (await cookies()).get(ACCESS_COOKIE)?.value;
}

/** Ekip sayfaları: yetkisi olmayana sayfa yokmuş gibi davranılır (404), oturum yoksa girişe. */
export async function staffGet<T>(locale: Locale, path: string, back: string): Promise<T> {
  try {
    return await authedGet<T>(locale, path, back);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
    throw e;
  }
}

/** Oturumlu API okuması; oturum geçersizse girişe (geri dönüş adresiyle). */
export async function authedGet<T>(locale: Locale, path: string, back: string): Promise<T> {
  const token = await currentToken();
  const toLogin = () => redirect(`${localePath(locale, '/giris')}?next=${encodeURIComponent(localePath(locale, back))}`);
  if (!token) toLogin();
  try {
    return await apiGet<T>(path, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) toLogin();
    throw e;
  }
}
