const API_ORIGIN = new URL(process.env.API_URL ?? 'http://127.0.0.1:3000').origin;
// Canlıda fotoğraflar API'nin genel adresinden (PUBLIC_URL, ör. https://api.alanadi.com) gelir.
const MEDIA_ORIGIN = process.env.API_PUBLIC_URL ? new URL(process.env.API_PUBLIC_URL).origin : '';

/**
 * Güvenlik başlıkları. `nonce` verilirse (girişli, her istekte üretilen sayfalar) betikler yalnızca nonce ile çalışır.
 * Önbellekli herkese açık sayfalarda nonce kullanılamaz (Next belgesi: nonce dinamik üretim ister); orada satır içi
 * betiğe izin verilir ama dış kaynaklı hiçbir betik yüklenemez.
 */
export function securityHeaders(o: { nonce?: string; isProd: boolean; isDev?: boolean }): Record<string, string> {
  const script = o.nonce ? `'self' 'nonce-${o.nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'";
  const csp = [
    "default-src 'self'",
    `script-src ${script}${o.isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${API_ORIGIN}${MEDIA_ORIGIN ? ` ${MEDIA_ORIGIN}` : ''}`,
    "font-src 'self'",
    `connect-src 'self'${o.isDev ? ' ws:' : ''}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(o.isProd ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
  };
}

/** Durum değiştiren isteklerde: Origin başlığı var ve sitenin kendi adresi (başka siteden sahte istek yok). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
