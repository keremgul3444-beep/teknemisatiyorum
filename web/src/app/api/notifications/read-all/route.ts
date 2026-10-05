import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

/** Bildirim sayfası açılınca hepsi okundu. */
export async function POST(req: Request) {
  const r = await relay(req, '/notifications/read-all', undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
