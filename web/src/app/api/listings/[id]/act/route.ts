import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Satıcının ilan işlemleri: satıldı olarak işaretle ya da yayından kaldır (sahiplik API'de denetlenir). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { action } = await readJson(req);
  if (!ID.test(id) || (action !== 'sold' && action !== 'withdraw')) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = action === 'sold'
    ? await relay(req, `/listings/${id}/sold`, undefined, { auth: true })
    : await relay(req, `/listings/${id}`, undefined, { auth: true, method: 'DELETE' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
