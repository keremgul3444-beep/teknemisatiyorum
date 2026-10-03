import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** T.C. kimlik doğrulaması (ilan vermek için seviye 2). Numara yalnızca API'ye aktarılır, sitede saklanmaz. */
export async function POST(req: Request) {
  const { tckn, firstName, lastName, birthYear } = await readJson(req);
  if (typeof tckn !== 'string' || !/^\d{11}$/.test(tckn) || typeof firstName !== 'string' || typeof lastName !== 'string' || typeof birthYear !== 'number') {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const r = await relay(req, '/verification/identity', { tckn, firstName, lastName, birthYear }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ ok: true, verifyLevel: r.ok.verifyLevel }), r.fresh);
}
