import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9-]{8,40}$/i;

/** Taslağın fotoğraf listesi ve sırası (ilk fotoğraf kapak). */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { fileIds } = await readJson(req);
  if (!ID.test(id) || !Array.isArray(fileIds) || !fileIds.length || fileIds.some((f) => typeof f !== 'string' || !ID.test(f))) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const r = await relay(req, `/listings/${id}/photos`, { fileIds }, { auth: true, method: 'PUT' });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
