import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9-]{8,40}$/i;

/** İlanın ruhsat başvurusu: ruhsat ve (varsa) motor seri no fotoğrafı + seri numarasının son haneleri. Ekip onaylar. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { fileIds, engineSerialLast4 } = await readJson(req);
  if (!ID.test(id) || !Array.isArray(fileIds) || !fileIds.length || fileIds.length > 2 || fileIds.some((f) => typeof f !== 'string' || !ID.test(f))) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const serial = typeof engineSerialLast4 === 'string' && engineSerialLast4.trim() ? { details: { engineSerialLast4: engineSerialLast4.trim() } } : {};
  const r = await relay(req, '/verification/requests', { kind: 'ruhsat', listingId: id, fileIds, ...serial }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id, status: r.ok.status }), r.fresh);
}
