import { NextResponse } from 'next/server';
import { appleAssociation } from '@/lib/appLinks';

export const dynamic = 'force-dynamic';

/** /.well-known/apple-app-site-association (next.config yeniden yazar). */
export function GET() {
  const body = appleAssociation();
  return body ? NextResponse.json(body) : new NextResponse(null, { status: 404 });
}
