import type { NextConfig } from 'next';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
// Ölçüm (Umami, isteğe bağlı): betik ve gönderim sitenin kendi adresinden aktarılır.
const UMAMI = process.env.UMAMI_URL ?? 'http://umami:3000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@tms/shared'],
  // Görseller API'den; sitenin kendi görsel iyileştiricisi kullanılmaz (bellek) — API WebP genişlikleri üretir.
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/media/:path*', destination: `${API}/media/:path*` },
      // Uygulama bağlantısı doğrulama dosyaları (ilan bağlantıları telefonda uygulamada açılsın).
      { source: '/.well-known/apple-app-site-association', destination: '/api/well-known/apple' },
      { source: '/.well-known/assetlinks.json', destination: '/api/well-known/assetlinks' },
      { source: '/stats/script.js', destination: `${UMAMI}/script.js` },
      { source: '/stats/api/send', destination: `${UMAMI}/api/send` },
    ];
  },
};

export default config;
