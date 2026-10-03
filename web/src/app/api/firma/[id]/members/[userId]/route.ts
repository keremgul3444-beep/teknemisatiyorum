import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Personeli firmadan çıkar (sahip çıkarılamaz). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await ctx.params;
  if (!ID.test(id) || !ID.test(userId)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/companies/${id}/members/${userId}`, undefined, { auth: true, method: 'DELETE' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
