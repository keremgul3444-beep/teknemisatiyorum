import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from '@/lib/security';

/** Her istekte yeniden üretilen (girişli) sayfalar: nonce'lu sıkı güvenlik politikası burada. */
export const PRIVATE = /^\/(en\/)?(giris|hesabim|odeme)(\/|$)/;

/**
 * Dil yönlendirmesi + güvenlik başlıkları. TR öneksizdir: `/ilanlar` içeride `/tr/ilanlar`'a yeniden yazılır
 * (adres çubuğu değişmez); doğrudan `/tr/...` gelirse öneksiz adrese kalıcı yönlendirilir.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProd = process.env.NODE_ENV === 'production';
  const isDev = process.env.NODE_ENV === 'development';

  if (pathname === '/tr' || pathname.startsWith('/tr/')) {
    return NextResponse.redirect(new URL((pathname.slice(3) || '/') + search, req.url), 308);
  }

  const nonce = PRIVATE.test(pathname) ? Buffer.from(crypto.randomUUID()).toString('base64') : undefined;
  const headers = securityHeaders({ nonce, isProd, isDev });
  const requestHeaders = new Headers(req.headers);
  if (nonce) {
    requestHeaders.set('x-nonce', nonce);
    // Next, sayfa üretirken nonce'u istek başlığındaki politikadan okuyup kendi betiklerine ekler.
    requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy']);
  }

  const isEn = pathname === '/en' || pathname.startsWith('/en/');

  // Yayında olmayan ilan: Google'a "kalıcı olarak kalktı" (410), ziyaretçiye benzer ilanlar.
  const gone = await listingGone(pathname);
  if (gone) {
    const res = NextResponse.rewrite(new URL(`/${isEn ? 'en' : 'tr'}/ilan-kalkti`, req.url), { status: 410, request: { headers: requestHeaders } });
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  const res = isEn
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : NextResponse.rewrite(new URL(`/tr${pathname === '/' ? '' : pathname}${search}`, req.url), { request: { headers: requestHeaders } });
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

const LISTING = /^\/(?:en\/)?ilan\/[^/]*-([a-z0-9]{8,40})$/;

/** `/ilan/<slug>` için API'ye sor: 404 ise ilan kalkmış demektir. API'ye ulaşılamazsa sayfa normal akışa bırakılır. */
async function listingGone(pathname: string): Promise<boolean> {
  const m = LISTING.exec(pathname);
  if (!m) return false;
  const r = await fetch(`${process.env.API_URL ?? 'http://127.0.0.1:3000'}/listings/${m[1]}`, { method: 'GET', signal: AbortSignal.timeout(3000) }).catch(() => null);
  return r?.status === 404;
}

export const config = {
  // Statik dosyalar, API rotaları, görseller ve site haritası dil yönlendirmesinden geçmez.
  matcher: ['/((?!_next|api|media|favicon.ico|robots.txt|sitemap.xml|icon|apple-icon).*)'],
};
