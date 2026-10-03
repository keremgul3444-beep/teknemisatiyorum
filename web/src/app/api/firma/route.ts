import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Firma hesabı aç (kimliği doğrulanmış kullanıcı; açan kişi sahip olur). */
export async function POST(req: Request) {
  const { name, kind, city } = await readJson(req);
  if (typeof name !== 'string' || typeof kind !== 'string' || typeof city !== 'string') return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  const r = await relay(req, '/companies', { name, kind, city }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
