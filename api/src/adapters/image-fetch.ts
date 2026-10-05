import dns from 'dns';
import https from 'https';
import net from 'net';

/**
 * Toplu ilan yüklemesinde fotoğraf bağlantılarını indirir. Sunucunun iç ağına istek attırılamasın diye (SSRF):
 * yalnızca https ve 443; alan adı çözülünce yalnızca herkese açık IP'lere bağlanılır (bağlantı da o IP'ye yapılır,
 * DNS ikinci kez sorulmaz); en çok 3 yönlendirme (her biri yeniden denetlenir); yalnızca görsel; boyut ve süre sınırı.
 */
export const IMAGE_FETCHER = Symbol('IMAGE_FETCHER');
export type ImageFetcher = (url: string) => Promise<Buffer>;

export const FETCH_LIMITS = { maxBytes: 15 * 1024 * 1024, timeoutMs: 20_000, maxRedirects: 3 };

export class ImageFetchError extends Error {
  constructor(public code: 'url' | 'private' | 'status' | 'type' | 'size' | 'timeout' | 'network') {
    super(`Görsel indirilemedi: ${code}`);
  }
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
];
const v4num = (ip: string) => ip.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0;

/** Herkese açık (yerel, özel, ayrılmış olmayan) adres mi. */
export function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4num(ip);
    return !V4_BLOCKED.some(([base, bits]) => (n >>> (32 - bits)) === (v4num(base) >>> (32 - bits)));
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPublicIp(mapped[1]);
    if (x === '::' || x === '::1') return false;
    return !/^(fc|fd|fe[89ab]|ff)/.test(x.replace(/^0+/, '')) && !x.startsWith('64:ff9b:') && !x.startsWith('2001:db8');
  }
  return false;
}

function resolvePublic(host: string): Promise<{ address: string; family: number }> {
  return new Promise((ok, fail) => {
    if (net.isIP(host)) return isPublicIp(host) ? ok({ address: host, family: net.isIPv6(host) ? 6 : 4 }) : fail(new ImageFetchError('private'));
    dns.lookup(host, { all: true }, (e, addrs) => {
      if (e || !addrs.length) return fail(new ImageFetchError('network'));
      // Adreslerden biri bile iç ağdaysa reddedilir (DNS ile iç ağa yönlendirme denemesi).
      if (addrs.some((a) => !isPublicIp(a.address))) return fail(new ImageFetchError('private'));
      ok(addrs[0]);
    });
  });
}

export const fetchPublicImage: ImageFetcher = async (raw) => {
  let url = raw;
  for (let hop = 0; hop <= FETCH_LIMITS.maxRedirects; hop++) {
    let u: URL;
    try { u = new URL(url); } catch { throw new ImageFetchError('url'); }
    if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password) throw new ImageFetchError('url');
    const addr = await resolvePublic(u.hostname.replace(/^\[|\]$/g, ''));
    const res = await new Promise<{ status: number; location?: string; type?: string; body?: Buffer }>((ok, fail) => {
      const req = https.request({
        host: addr.address, family: addr.family, servername: net.isIP(u.hostname) ? undefined : u.hostname, port: 443,
        path: `${u.pathname}${u.search}`, method: 'GET', agent: false,
        headers: { host: u.host, 'user-agent': 'teknemisatiyorum-import/1.0', accept: 'image/*' },
        timeout: FETCH_LIMITS.timeoutMs,
      }, (r) => {
        const status = r.statusCode ?? 0;
        if (status >= 300 && status < 400) { r.resume(); return ok({ status, location: r.headers.location }); }
        const type = String(r.headers['content-type'] ?? '');
        if (status !== 200) { r.resume(); return ok({ status }); }
        if (!type.startsWith('image/')) { r.resume(); return ok({ status, type }); }
        const len = Number(r.headers['content-length'] ?? 0);
        if (len > FETCH_LIMITS.maxBytes) { r.destroy(); return fail(new ImageFetchError('size')); }
        const chunks: Buffer[] = [];
        let size = 0;
        r.on('data', (c: Buffer) => {
          size += c.length;
          if (size > FETCH_LIMITS.maxBytes) { r.destroy(); fail(new ImageFetchError('size')); } else chunks.push(c);
        });
        r.on('end', () => ok({ status, type, body: Buffer.concat(chunks) }));
        r.on('error', () => fail(new ImageFetchError('network')));
      });
      req.on('timeout', () => { req.destroy(); fail(new ImageFetchError('timeout')); });
      req.on('error', (e) => fail(e instanceof ImageFetchError ? e : new ImageFetchError('network')));
      req.end();
    });
    if (res.location) { url = new URL(res.location, url).toString(); continue; }
    if (res.status !== 200) throw new ImageFetchError('status');
    if (!res.body) throw new ImageFetchError('type');
    return res.body;
  }
  throw new ImageFetchError('url');
};
