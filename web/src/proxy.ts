import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from '@/lib/security';
import { ACCESS_COOKIE, clearSession, FRESH_TOKEN_HEADER, jwtExpired, REFRESH_COOKIE, refreshTokens, setSession } from '@/lib/session';

const API = () => process.env.API_URL ?? 'http://127.0.0.1:3000';

/** Her istekte yeniden üretilen (girişli) sayfalar: nonce'lu sıkı güvenlik politikası burada. */
const PRIVATE = /^\/(en\/)?(giris|hesabim|odeme|yonetim|firma)(\/|$)/;
/** Oturum gerektiren sayfalar (giriş sayfası hariç). */
const NEEDS_SESSION = /^\/(en\/)?(hesabim|odeme|yonetim|firma)(\/|$)/;
// Uzun adres (marka-model-yıl-…-kimlik) ve paylaşımdaki kısa adres (/ilan/kimlik): kalkan ilan ikisinde de 410.
const LISTING = /^\/(?:en\/)?ilan\/(?:[^/]*-)?([a-z0-9]{8,40})$/;

/**
 * Dil yönlendirmesi + güvenlik başlıkları + girişli sayfalarda oturum yenileme.
 * TR öneksizdir: `/ilanlar` içeride `/tr/ilanlar`'a yeniden yazılır (adres çubuğu değişmez);
 * doğrudan `/tr/...` gelirse öneksiz adrese kalıcı yönlendirilir.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = process.env.NODE_ENV === 'development';
  const isEn = pathname === '/en' || pathname.startsWith('/en/');

  if (pathname === '/tr' || pathname.startsWith('/tr/')) {
    return NextResponse.redirect(new URL((pathname.slice(3) || '/') + search, req.url), 308);
  }

  const nonce = PRIVATE.test(pathname) ? Buffer.from(crypto.randomUUID()).toString('base64') : undefined;
  const headers = securityHeaders({ nonce, isProd, isDev });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(FRESH_TOKEN_HEADER); // dışarıdan gelen sahte başlık sayfaya ulaşmasın
  if (nonce) {
    requestHeaders.set('x-nonce', nonce);
    // Next, sayfa üretirken nonce'u istek başlığındaki politikadan okuyup kendi betiklerine ekler.
    requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']);
  }
  const finish = (res: NextResponse) => {
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  };
  const pass = (target?: string, status?: number) => {
    const init = { request: { headers: requestHeaders }, ...(status ? { status } : {}) };
    if (target) return NextResponse.rewrite(new URL(target, req.url), init);
    return isEn ? NextResponse.next(init) : NextResponse.rewrite(new URL(`/tr${pathname === '/' ? '' : pathname}${search}`, req.url), init);
  };

  // Girişli sayfalar: erişim anahtarı yok/süresi dolmuşsa yenile; olmuyorsa girişe.
  let refreshed: { accessToken: string; refreshToken: string } | null = null;
  if (NEEDS_SESSION.test(pathname)) {
    const at = req.cookies.get(ACCESS_COOKIE)?.value;
    const rt = req.cookies.get(REFRESH_COOKIE)?.value;
    if (!at || jwtExpired(at)) {
      refreshed = rt ? await refreshTokens(API(), rt) : null;
      if (!refreshed) {
        const url = new URL(`${isEn ? '/en' : ''}/giris`, req.url);
        url.searchParams.set('next', pathname + search);
        const res = NextResponse.redirect(url);
        clearSession(res);
        return finish(res);
      }
      requestHeaders.set(FRESH_TOKEN_HEADER, refreshed!.accessToken);
    }
  }

  // Yayında olmayan ilan: Google'a "kalıcı olarak kalktı" (410), ziyaretçiye benzer ilanlar.
  if (await listingGone(pathname)) return finish(pass(`/${isEn ? 'en' : 'tr'}/ilan-kalkti`, 410));

  const res = pass();
  if (refreshed) setSession(res, refreshed);
  return finish(res);
}

/** `/ilan/<slug>` için API'ye sor: 404 ise ilan kalkmış demektir. API'ye ulaşılamazsa sayfa normal akışa bırakılır. */
async function listingGone(pathname: string): Promise<boolean> {
  const m = LISTING.exec(pathname);
  if (!m) return false;
  // Yalnızca varlık denetimi: görüntülenme sayılmaz (sayılsaydı botlar ve ön yüklemeler istatistiği şişirirdi).
  const r = await fetch(`${API()}/listings/${m[1]}`, { method: 'GET', headers: { 'X-Tms-No-Count': '1' }, signal: AbortSignal.timeout(3000) }).catch(() => null);
  return r?.status === 404;
}

export const config = {
  // Statik dosyalar, API rotaları, görseller ve site haritası dil yönlendirmesinden geçmez.
  matcher: ['/((?!_next|api|media|favicon.ico|robots.txt|sitemap.xml|icon|apple-icon).*)'],
};
