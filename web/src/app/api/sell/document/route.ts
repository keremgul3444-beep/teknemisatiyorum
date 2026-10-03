import { NextResponse } from 'next/server';
import { relayUpload, withFresh } from '@/lib/bff';

const MAX_BYTES = 10 * 1024 * 1024;

/** Korumalı belge yükleme (ruhsat, motor seri no fotoğrafı): görsel ya da PDF; yalnızca sahibi ve ekip görür. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_BYTES || !/^(image\/|application\/pdf$)/.test(file.type)) {
    return NextResponse.json({ code: 'VALIDATION', messageKey: 'errors.validation' }, { status: 400 });
  }
  const out = new FormData();
  out.set('visibility', 'private');
  out.set('file', file, 'document');
  const r = await relayUpload(req, '/media', out);
  if (r.res) return r.res;
  return withFresh(NextResponse.json({ id: r.ok.id }), r.fresh);
}
