import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';
import { clearSession } from '@/lib/session';

const PREFS = ['notifyMessages', 'notifyMatches', 'notifyMarketing', 'phoneVisible', 'marketingConsent'] as const;

/** Ad ve bildirim/gizlilik tercihleri (yalnızca bilinen alanlar geçer; doğrulama API'de). */
export async function PATCH(req: Request) {
  const b = await readJson(req);
  const body: Record<string, unknown> = {};
  if (typeof b.name === 'string') body.name = b.name;
  if (b.prefs && typeof b.prefs === 'object') {
    body.prefs = Object.fromEntries(Object.entries(b.prefs as Record<string, unknown>).filter(([k, v]) => (PREFS as readonly string[]).includes(k) && typeof v === 'boolean'));
  }
  const r = await relay(req, '/me', body, { auth: true, method: 'PATCH' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json(r.ok), r.fresh);
}

/** Hesabı sil: API siler, tarayıcıdaki oturum kapanır. */
export async function DELETE(req: Request) {
  const r = await relay(req, '/me', undefined, { auth: true, method: 'DELETE' });
  if (r.res) return r.res;
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
