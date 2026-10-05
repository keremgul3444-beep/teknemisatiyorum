import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Teklif talebi (API doğrular: açık izin zorunlu, günlük sınır). */
export async function POST(req: Request) {
  const { kind, listingId, note, consent } = await readJson(req);
  const r = await relay(req, '/leads', { kind, listingId, note: typeof note === 'string' ? note : '', consent }, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
