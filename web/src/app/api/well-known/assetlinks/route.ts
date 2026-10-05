import { NextResponse } from 'next/server';
import { androidAssetLinks } from '@/lib/appLinks';

export const dynamic = 'force-dynamic';

/** /.well-known/assetlinks.json (next.config yeniden yazar). */
export function GET() {
  const body = androidAssetLinks();
  return body ? NextResponse.json(body) : new NextResponse(null, { status: 404 });
}
