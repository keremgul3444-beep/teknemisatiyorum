import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** İlan düzenleme: yalnızca değişen alanlar (PATCH /listings/:id). Alanları ve yeniden onay kuralını API uygular. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const body = await readJson(req);
  const r = await relay(req, `/listings/${id}`, body, { auth: true, method: 'PATCH' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id, status: r.ok.status }), r.fresh);
}
