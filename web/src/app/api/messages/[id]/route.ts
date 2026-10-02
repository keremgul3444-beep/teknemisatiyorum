import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Sitedeki sohbet sayfasından yanıt. Sohbetin üyesi olmayan 404 alır (sunucu denetler). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { text } = await readJson(req);
  if (!ID.test(id) || typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const r = await relay(req, `/conversations/${id}/messages`, { text: text.trim() }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
