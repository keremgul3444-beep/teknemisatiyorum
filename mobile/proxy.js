// Metro geliştirme sunucusunun `/api/*` proxy'si (metro.config.js kullanır). Ayrı dosyada ki test edilebilsin.
const http = require('http');

/**
 * İstemcinin gönderdiği X-Forwarded-For korunur ama gerçek bağlantı adresi HER ZAMAN sona eklenir.
 * API yalnızca son (güvenilen proxy'nin eklediği) adrese güvenir; istemci sahte IP ile istek sınırlarını aşamaz.
 */
function forwardedFor(xff, remote) {
  return xff ? `${xff}, ${remote}` : remote;
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
