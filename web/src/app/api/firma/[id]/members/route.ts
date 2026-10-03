import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;

/** Personel ekle ya da rolünü değiştir (sahip ya da yönetici). Kişinin önce hesap açmış olması gerekir. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { phone, role } = await readJson(req);
  if (!ID.test(id) || typeof phone !== 'string' || (role !== 'admin' && role !== 'staff')) return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, `/companies/${id}/members`, { phone, role }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true }), r.fresh);
}
