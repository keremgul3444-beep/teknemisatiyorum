import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';
import { MAX_CSV } from '@/lib/bulkImport';

const ID = /^[a-z0-9]{8,40}$/i;


/** Toplu ilan yüklemesini başlatır (satırlar sunucuda arka planda işlenir). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { csv } = await readJson(req);
  if (!ID.test(id) || typeof csv !== 'string' || !csv.trim() || csv.length > MAX_CSV) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/companies/${id}/imports`, { csv }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json(r.ok), r.fresh);
}
