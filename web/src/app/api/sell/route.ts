import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Sitedeki ilan formu: taslağı açar (POST /listings). Alanları API doğrular. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const r = await relay(req, '/listings', body, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
