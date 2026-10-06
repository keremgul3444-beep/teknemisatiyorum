import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** İlanı bildir (gerekçe ve not API'de doğrulanır; günlük sınır var). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const { reason, note } = await readJson(req);
  const r = await relay(req, `/listings/${id}/report`, { reason, note: typeof note === 'string' ? note : '' }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
