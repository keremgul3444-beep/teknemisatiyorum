import { NextResponse } from 'next/server';
import { readJson, relay } from '@/lib/bff';

export async function POST(req: Request) {
  const { listingId, productCode } = await readJson(req);
  const r = await relay(req, '/orders', { listingId, productCode }, { auth: true });
  if (r.res) return r.res;
  return NextResponse.json({ orderId: r.ok.orderId, checkoutUrl: r.ok.checkoutUrl });
}
