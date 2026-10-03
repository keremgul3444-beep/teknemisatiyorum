import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = '[a-z0-9-]{8,40}';
/** Sitedeki yönetim panelinin çağırabileceği işlemler (başka /admin uçları buradan geçmez). Yetki API'de denetlenir. */
const ALLOWED = [
  new RegExp(`^listings/${ID}/decision$`), new RegExp(`^listings/${ID}/takedown$`), new RegExp(`^listings/${ID}/reports/dismiss$`),
  new RegExp(`^users/${ID}/suspend$`), new RegExp(`^users/${ID}/unsuspend$`), new RegExp(`^verifications/${ID}/decision$`),
  new RegExp(`^service-payments/${ID}/refund$`), new RegExp(`^service-payments/${ID}/release$`),
];

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join('/');
  if (!ALLOWED.some((r) => r.test(path))) return NextResponse.json({ code: 'NOT_FOUND', messageKey: 'errors.notFound' }, { status: 404 });
  const body = await readJson(req);
  const r = await relay(req, `/admin/${path}`, Object.keys(body).length ? body : undefined, { auth: true });
  if (r.res) return r.res;
  return withFresh(NextResponse.json(r.ok), r.fresh);
}
