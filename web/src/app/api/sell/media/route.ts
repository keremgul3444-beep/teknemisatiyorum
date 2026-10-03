import { NextResponse } from 'next/server';
import { relayUpload, withFresh } from '@/lib/bff';

const MAX_BYTES = 10 * 1024 * 1024;

/** İlan fotoğrafı yükleme: yalnızca tek görsel ve herkese açık görünürlük (belgeler uygulamadan yüklenir). */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES || !/^image\//.test(file.type)) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const out = new FormData();
  out.set('visibility', 'public');
  out.set('file', file, 'photo');
  const r = await relayUpload(req, '/media', out);
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
