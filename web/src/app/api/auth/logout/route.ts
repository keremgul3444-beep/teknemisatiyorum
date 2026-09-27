import { NextResponse } from 'next/server';
import { relay } from '@/lib/bff';
import { clearSession } from '@/lib/session';

export async function POST(req: Request) {
  const r = await relay(req, '/auth/logout', undefined, { auth: true });
  if (r.res?.status === 403) return r.res;
  const res = NextResponse.json({ ok: true });
  clearSession(res); // API hatası olsa da tarayıcıdaki oturum kapanır
  return res;
}
