import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;
const bad = () => NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });

/** Kayıtlı aramayı sil. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return bad();
  const r = await relay(req, `/saved-searches/${id}`, undefined, { auth: true, method: 'DELETE' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}

/** Sonuçlar görüldü: "yeni ilan" sayacı sıfırlanır. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return bad();
  const r = await relay(req, `/saved-searches/${id}/seen`, undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
