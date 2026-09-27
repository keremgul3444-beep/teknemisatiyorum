import type { NextConfig } from 'next';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@tms/shared'],
  // Görseller API'den; sitenin kendi görsel iyileştiricisi kullanılmaz (bellek) — API WebP genişlikleri üretir.
  images: { unoptimized: true },
  async rewrites() {
    return [{ source: '/media/:path*', destination: `${API}/media/:path*` }];
  },
};

export default config;
