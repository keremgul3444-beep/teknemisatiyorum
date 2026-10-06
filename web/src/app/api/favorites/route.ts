import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** İlan favorilerde mi? Oturum yoksa `{ favorited: false, loggedIn: false }` (sayfa hata göstermez). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!ID.test(id)) return NextResponse.json({ favorited: false, loggedIn: false });
  const r = await relay(req, `/favorites/${id}`, undefined, { auth: true, method: 'GET' });
  if (r.res) return r.res.status === 401 ? NextResponse.json({ favorited: false, loggedIn: false }) : r.res;
  return withFresh(NextResponse.json({ favorited: !!r.ok.favorited, loggedIn: true }), r.fresh);
}

/** Favoriye ekle (`on: true`) ya da çıkar. */
export async function POST(req: Request) {
  const { id, on } = await readJson(req);
  if (typeof id !== 'string' || !ID.test(id)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/favorites/${id}`, undefined, { auth: true, method: on ? 'PUT' : 'DELETE' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ favorited: !!on }), r.fresh);
}
