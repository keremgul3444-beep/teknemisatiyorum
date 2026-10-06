import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

/** KVKK veri kopyası: JSON dosyası olarak indirilir. */
export async function GET(req: Request) {
  const r = await relay(req, '/me/export', undefined, { auth: true, method: 'GET' });
  if (r.res) return r.res;
  const res = new NextResponse(JSON.stringify(r.ok, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="verilerim.json"', 'Cache-Control': 'no-store' },
  });
  return withFresh(res, r.fresh);
}
