import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9-]{8,40}$/i;

/** Moderatör korumalı belgeyi açar: API 5 dakikalık imzalı bağlantı verir (erişim denetim kaydına yazılır), oraya yönlendirilir. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ID.test(id)) return NextResponse.json({ code: 'NOT_FOUND', messageKey: 'errors.notFound' }, { status: 404 });
  const r = await relay(req, `/media/${id}/signed`, undefined, { auth: true, method: 'GET' });
  if (r.res) return r.res;
  const url = String(r.ok.url ?? '');
  if (!url.startsWith('/media/')) return NextResponse.json({ code: 'NOT_FOUND', messageKey: 'errors.notFound' }, { status: 404 });
  return withFresh(NextResponse.redirect(new URL(url, req.url), 303), r.fresh);
}
