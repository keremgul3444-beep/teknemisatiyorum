import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;
const ACTIONS = ['read', 'share-phone'] as const;

/** Sohbet işlemleri: okundu işaretle, numaramı bu kişiyle paylaş. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { action } = await readJson(req);
  if (!ID.test(id) || !ACTIONS.includes(action as (typeof ACTIONS)[number])) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/conversations/${id}/${action}`, undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
