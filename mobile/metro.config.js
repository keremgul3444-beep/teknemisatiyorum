// Metro ayarı: ortak paketi izler ve geliştirmede `/api/*` isteklerini yerel sunucuya (localhost:3000) aktarır.
// Böylece telefon, Expo tüneliyle aynı adres üzerinden sunucuya da ulaşır; ikinci bir tünel gerekmez.
const path = require('path');
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

const API_TARGET = { host: '127.0.0.1', port: Number(process.env.API_PORT ?? 3000) };

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => (req, res, next) => {
    if (!req.url.startsWith('/api/')) return metroMiddleware(req, res, next);
    const headers = { ...req.headers, host: `${API_TARGET.host}:${API_TARGET.port}` };
    headers['x-forwarded-for'] = headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '';
    const upstream = http.request(
      { ...API_TARGET, method: req.method, path: req.url.slice(4), headers },
      (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); },
    );
    upstream.on('error', () => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'NETWORK', messageKey: 'errors.network' }));
    });
    req.pipe(upstream);
  },
};

module.exports = config;
