import { localePath, type Locale } from '@/i18n';

export const ACCESS_COOKIE = 'tms_at';
export const REFRESH_COOKIE = 'tms_rt';
export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 3600;
/** Ara katman yeni anahtarı aynı istekte sayfaya bu başlıkla iletir (çerez ancak yanıtta yazılır). */
export const FRESH_TOKEN_HEADER = 'x-tms-at';
export const isProd = () => process.env.NODE_ENV === 'production';

/** Oturum çerezleri: JavaScript erişemez (HttpOnly), başka siteden gönderilmez (Lax), canlıda yalnızca HTTPS. */
export const cookieOptions = (maxAge: number, prod: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, path: '/', secure: prod, maxAge });

/** Yalnızca "yenilemeli mi" kararı için imzasız okuma; anahtarı doğrulayan API'dir. */
export function jwtExpired(token: string, now = Date.now(), skewS = 30): boolean {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof exp !== 'number' || exp * 1000 - skewS * 1000 <= now;
  } catch {
    return true;
  }
}

/** Ziyaretçinin IP adresi: önümüzdeki ara katmanın (canlıda yük dengeleyici) eklediği ilk halka. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
}

/** Girişten sonra dönülecek adres: yalnızca site içi yol (açık yönlendirme yok). */
export function safeNext(next: string | undefined, locale: Locale): string {
  if (next && /^\/(?![/\\])/.test(next) && !next.includes('://')) return next;
  return localePath(locale, '/hesabim');
}

type Cookieable = { cookies: { set(name: string, value: string, o: ReturnType<typeof cookieOptions>): unknown } };

export function setSession(res: Cookieable, t: { accessToken: string; refreshToken: string }) {
  res.cookies.set(ACCESS_COOKIE, t.accessToken, cookieOptions(ACCESS_MAX_AGE, isProd()));
  res.cookies.set(REFRESH_COOKIE, t.refreshToken, cookieOptions(REFRESH_MAX_AGE, isProd()));
}

export function clearSession(res: Cookieable) {
  res.cookies.set(ACCESS_COOKIE, '', cookieOptions(0, isProd()));
  res.cookies.set(REFRESH_COOKIE, '', cookieOptions(0, isProd()));
}

/** İstekteki çerez değeri (rota işleyicilerinde `cookies()` yerine doğrudan başlıktan). */
export function cookieValue(req: Request, name: string) {
  const m = (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) || undefined : undefined;
}
