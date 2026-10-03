import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

export async function POST(req: Request) {
  const { listingId, productCode, accept } = await readJson(req);
  const r = await relay(req, '/orders', { listingId, productCode, accept: accept === true }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ orderId: r.ok.orderId, checkoutUrl: r.ok.checkoutUrl }), r.fresh);
}
