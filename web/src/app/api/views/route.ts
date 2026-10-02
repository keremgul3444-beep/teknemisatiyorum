import { API_URL } from '@/lib/api';
import { forbidden, readJson } from '@/lib/bff';
import { sameOrigin } from '@/lib/security';
import { ACCESS_COOKIE, clientIp, cookieValue, jwtExpired } from '@/lib/session';

const ID = /^[a-z0-9]{8,40}$/i;

/**
 * İlan sayfası tarayıcıda açılınca bir kez çağrılır: gerçek ziyaret sayılır (ara katman, sayfa önbelleği ve
 * JavaScript çalıştırmayan botlar sayılmaz). Oturum varsa iletilir ki satıcının kendi ziyareti sayılmasın.
 * Sayma başarısız olsa da yanıt 204: ziyaretçinin sayfası hiçbir zaman etkilenmez.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return forbidden();
  const { id } = await readJson(req);
  if (typeof id !== 'string' || !ID.test(id)) return new Response(null, { status: 204 });
  const token = cookieValue(req, ACCESS_COOKIE);
  await fetch(`${API_URL}/listings/${id}/view`, {
    method: 'POST',
    signal: AbortSignal.timeout(3000),
    headers: { 'X-Forwarded-For': clientIp(req), ...(token && !jwtExpired(token) ? { Authorization: `Bearer ${token}` } : {}) },
  }).catch(() => null);
  return new Response(null, { status: 204 });
}
