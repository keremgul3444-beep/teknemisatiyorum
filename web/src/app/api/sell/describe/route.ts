import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

/** Sihirbazda açıklama taslağı (API doğrular; modelle ya da kural tabanlı). Kaydetmez. */
export async function POST(req: Request) {
  const body = await readJson(req);
  const r = await relay(req, '/listings/describe', body, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ text: r.ok.text, source: r.ok.source }), r.fresh);
}
