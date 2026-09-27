import { NextResponse } from 'next/server';
import { readJson, relay } from '@/lib/bff';

export async function POST(req: Request) {
  const { phone } = await readJson(req);
  const r = await relay(req, '/auth/otp', { phone });
  if (r.res) return r.res;
  // Kapalı betada API kodu yalnızca geliştirmede ve ekip dışı numaraya döndürür; aynen iletilir.
  return NextResponse.json(r.ok?.devCode ? { devCode: r.ok.devCode } : {});
}
