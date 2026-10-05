import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Aramayı kaydet: özet metin + filtre (API doğrular; en fazla 20 arama). */
export async function POST(req: Request) {
  const { text, filter } = await readJson(req);
  if (typeof text !== 'string' || !text.trim() || typeof filter !== 'object' || !filter) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const r = await relay(req, '/saved-searches', { text: text.slice(0, 300), filter }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
