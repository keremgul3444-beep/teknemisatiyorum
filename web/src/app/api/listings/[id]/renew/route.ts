import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Süresi dolan ya da dolmak üzere olan ilanı yenile (90 gün, onaya düşmez). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/listings/${id}/renew`, undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
