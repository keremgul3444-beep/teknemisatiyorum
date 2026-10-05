import { NextResponse } from 'next/server';
import { relay, withFresh } from '@/lib/bff';

/** Örnek dosya: Excel'de doğrudan açılan, `;` ayraçlı UTF-8 CSV. */
export async function GET(req: Request) {
  const r = await relay(req, '/companies/x/imports/template', undefined, { auth: true, method: 'GET' });
  if (r.res) return r.res;
  return withFresh(new NextResponse(String(r.ok.csv ?? ''), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${String(r.ok.filename ?? 'sablon.csv')}"` },
  }), r.fresh);
}
