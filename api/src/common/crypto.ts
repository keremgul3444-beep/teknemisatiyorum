import crypto from 'crypto';
import { env } from '../config/env';

/** AES-256-GCM ile şifreler; çıktı `iv.tag.veri` (base64url). Anahtar yalnızca ortam ayarında durur. */
export function encrypt(plain: string): string {
  const key = Buffer.from(env().ID_ENC_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(token: string): string {
  const [iv, tag, data] = token.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(env().ID_ENC_KEY, 'base64'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

/** Süreli bağlantılar için imza (JWT gizli anahtarından türetilir). */
export function sign(payload: string): string {
  return crypto.createHmac('sha256', `media:${env().JWT_SECRET}`).update(payload).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
