import { NextResponse } from 'next/server';
import { readJson, relay, withFresh } from '@/lib/bff';

const ID = /^[a-z0-9]{8,40}$/i;
const bad = () => NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });

/**
 * Siteden satıcıya ilk mesaj: ilan konusu üzerinden sohbet açılır (varsa aynısı kullanılır), mesaj gönderilir.
 * Oturum yoksa 401 döner; sayfa girişe yönlendirir. Satıcının telefon numarası hiçbir zaman dönmez.
 */
export async function POST(req: Request) {
  const { listingId, text } = await readJson(req);
  if (typeof listingId !== 'string' || !ID.test(listingId) || typeof text !== 'string' || !text.trim() || text.length > 2000) return bad();
  const start = await relay(req, '/conversations', { subjectKind: 'listing', subjectId: listingId }, { auth: true });
  if (start.res) return start.res;
  const id = String(start.ok.id);
  const token = start.fresh?.accessToken;
  const sent = await relay(req, `/conversations/${encodeURIComponent(id)}/messages`, { text: text.trim() }, { auth: true, ...(token ? { token } : {}) });
  if (sent.res) return withFresh(sent.res, start.fresh);
  return withFresh(NextResponse.json({ conversationId: id }), start.fresh);
}
