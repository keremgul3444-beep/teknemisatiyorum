import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Sohbetteki karşı tarafı engelle (`on: true`) ya da engeli kaldır. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { on } = await readJson(req);
  if (!ID.test(id) || typeof on !== 'boolean') return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/conversations/${id}/${on ? 'block' : 'unblock'}`, undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ blocked: on }), r.fresh);
}
