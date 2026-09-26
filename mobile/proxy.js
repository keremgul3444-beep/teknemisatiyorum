// Metro geliştirme sunucusunun `/api/*` proxy'si (metro.config.js kullanır). Ayrı dosyada ki test edilebilsin.
const http = require('http');

/**
 * Gerçek bağlantı adresi HER ZAMAN sona eklenir. Gelen X-Forwarded-For'dan yalnızca son halka (bize bağlanan
 * tünelin eklediği gerçek istemci adresi) tutulur; istemcinin kendi uydurduğu önceki adresler atılır. Böylece
 * API ("loopback" güvenir) tünel arkasındaki istemcinin sahte IP ile istek sınırlarını aşmasına izin vermez.
 */
function forwardedFor(xff, remote) {
  const last = xff ? String(xff).split(',').map((s) => s.trim()).filter(Boolean).at(-1) : undefined;
  return last ? `${last}, ${remote}` : remote;
}

function apiProxy(target) {
  return (req, res) => {
    const headers = { ...req.headers, host: `${target.host}:${target.port}` };
    headers['x-forwarded-for'] = forwardedFor(req.headers['x-forwarded-for'], req.socket.remoteAddress ?? '');
    const upstream = http.request(
      { ...target, method: req.method, path: req.url.slice(4), headers },
      (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); },
    );
    upstream.on('error', () => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 'NETWORK', messageKey: 'errors.network' }));
    });
    req.pipe(upstream);
  };
}

module.exports = { forwardedFor, apiProxy };
