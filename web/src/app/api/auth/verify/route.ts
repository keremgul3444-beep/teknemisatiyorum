import { NextResponse } from 'next/server';
import { readJson, relay } from '@/lib/bff';
import { setSession } from '@/lib/session';

/** Kod doğrulama: anahtarlar yanıt gövdesine değil HttpOnly çerezlere yazılır. */
export async function POST(req: Request) {
  const { phone, code } = await readJson(req);
  const r = await relay(req, '/auth/verify', { phone, code, deviceName: 'Web' });
  if (r.res) return r.res;
  const body = r.ok as { accessToken: string; refreshToken: string; user?: { name?: string | null } };
  const res = NextResponse.json({ ok: true, user: { name: body.user?.name ?? null } });
  setSession(res, body);
  return res;
}
