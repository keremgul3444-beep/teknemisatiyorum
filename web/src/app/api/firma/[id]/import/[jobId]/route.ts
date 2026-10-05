import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Yükleme durumu (sayfa birkaç saniyede bir sorar). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await ctx.params;
  if (!ID.test(id) || !ID.test(jobId)) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/companies/${id}/imports/${jobId}`, undefined, { auth: true, method: 'GET' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json(r.ok), r.fresh);
}
