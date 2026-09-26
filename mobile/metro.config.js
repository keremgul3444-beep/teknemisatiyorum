// Metro ayarı: ortak paketi izler ve geliştirmede `/api/*` isteklerini yerel sunucuya (localhost:3000) aktarır.
// Böylece telefon, Expo tüneliyle aynı adres üzerinden sunucuya da ulaşır; ikinci bir tünel gerekmez.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { apiProxy } = require('./proxy');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

const forward = apiProxy({ host: '127.0.0.1', port: Number(process.env.API_PORT ?? 3000) });

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => (req, res, next) =>
    req.url.startsWith('/api/') ? forward(req, res) : metroMiddleware(req, res, next),
};

module.exports = config;
