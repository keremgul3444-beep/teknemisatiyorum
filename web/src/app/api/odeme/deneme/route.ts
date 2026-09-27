import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Deneme ödeme sayfasının düğmeleri (API yalnızca PAYMENTS_MODE=dev iken kabul eder). */
export async function POST(req: Request) {
  const { orderId, result } = await readJson(req);
  const r = await relay(req, '/payments/web/dev-complete', { orderId, result }, { auth: true });
  return r.res ? r.res : withFresh(NextResponse.json({ ok: true }), r.fresh);
}
