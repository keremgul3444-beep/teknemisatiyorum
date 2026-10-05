import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Ölçüm ayarı istek anında okunur (Umami'de site oluşturulunca yeniden derleme gerekmez). */
export function GET() {
  const websiteId = /^[0-9a-f-]{36}$/i.test(process.env.UMAMI_WEBSITE_ID ?? '') ? process.env.UMAMI_WEBSITE_ID! : '';
  return NextResponse.json({ websiteId }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
