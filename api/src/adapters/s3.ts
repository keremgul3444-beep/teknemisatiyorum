import crypto from 'crypto';

/** S3 uyumlu depolama ayarı (AWS S3, Cloudflare R2, Backblaze B2, MinIO). Yol biçimli adres: `${endpoint}/${bucket}/${key}`. */
export interface S3Config { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }

const sha256 = (d: string | Buffer) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k: crypto.BinaryLike, d: string) => crypto.createHmac('sha256', k).update(d).digest();
/** RFC 3986: S3 yol parçalarında yalnızca harf, rakam ve -._~ kodlanmadan kalır. */
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * AWS Signature Version 4 yetki başlığı. Gövde özeti `x-amz-content-sha256` başlığında gönderilir.
 * `headers` imzalanacak tüm başlıkları (host dahil) küçük harfle içermelidir.
 */
export function signV4(o: {
  method: string; path: string; query?: string; headers: Record<string, string>; payloadHash: string;
  region: string; accessKeyId: string; secretAccessKey: string; amzDate: string; service?: string;
}) {
  const service = o.service ?? 's3';
  const date = o.amzDate.slice(0, 8);
  const names = Object.keys(o.headers).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders = names.map((n) => `${n}:${String(o.headers[n]).trim()}\n`).join('');
  const signedHeaders = names.join(';');
  const canonical = [o.method, o.path, o.query ?? '', canonicalHeaders, signedHeaders, o.payloadHash].join('\n');
  const scope = `${date}/${o.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', o.amzDate, scope, sha256(canonical)].join('\n');
  const kDate = hmac(`AWS4${o.secretAccessKey}`, date);
  const kSigning = hmac(hmac(hmac(kDate, o.region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');
  return { authorization: `AWS4-HMAC-SHA256 Credential=${o.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, signature };
}

/** Küçük S3 istemcisi: put/get/delete yeterli (dosya anahtarları sunucuda üretilir). */
export class S3Client {
  constructor(private readonly c: S3Config, private readonly fetchImpl: typeof fetch = fetch) {}

  private async send(method: 'PUT' | 'GET' | 'DELETE', key: string, body?: Buffer) {
    const url = new URL(this.c.endpoint);
    const path = `${url.pathname.replace(/\/$/, '')}/${enc(this.c.bucket)}/${key.split('/').map(enc).join('/')}`;
    const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const payloadHash = sha256(body ?? '');
    const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    const { authorization } = signV4({ method, path, headers, payloadHash, region: this.c.region, accessKeyId: this.c.accessKeyId, secretAccessKey: this.c.secretAccessKey, amzDate });
    const res = await this.fetchImpl(`${url.protocol}//${url.host}${path}`, {
      method, body: body ? new Uint8Array(body) : undefined,
      headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, authorization, ...(body ? { 'content-length': String(body.length) } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
    return res;
  }

  async put(key: string, data: Buffer) {
    const r = await this.send('PUT', key, data);
    if (!r.ok) throw new Error(`S3 PUT ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }

  async get(key: string): Promise<Buffer | null> {
    const r = await this.send('GET', key);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`S3 GET ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }

  async remove(key: string) {
    const r = await this.send('DELETE', key);
    if (!r.ok && r.status !== 404) throw new Error(`S3 DELETE ${r.status}`);
  }
}
