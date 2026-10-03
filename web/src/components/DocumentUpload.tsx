'use client';
import { useState } from 'react';

type Dict = Record<string, string>;

/** Ruhsat başvurusu: ruhsat (zorunlu), motor seri no fotoğrafı ve son haneleri (isteğe bağlı; ikisi birlikte rozet getirir). */
export function DocumentUpload({ listingId, L, errors, doneHref }: { listingId: string; L: Dict; errors: Dict; doneHref: string }) {
  const [license, setLicense] = useState<File | null>(null);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const serialOk = !serial || /^[A-Za-z0-9]{2,6}$/.test(serial.trim());
  const msg = (key?: string) => errors[String(key ?? '').replace(/^errors\./, '')] ?? errors.generic;

  const upload = async (file: File) => {
    const form = new FormData();
    form.set('file', file);
    const r = await fetch('/api/sell/document', { method: 'POST', body: form }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(r ? msg(j.messageKey) : errors.network ?? errors.generic);
    return j.id as string;
  };
  const send = async () => {
    if (!license) return;
    setBusy(true); setError('');
    try {
      const ids = [await upload(license), ...(serialPhoto ? [await upload(serialPhoto)] : [])];
      const r = await fetch(`/api/sell/${listingId}/document`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds: ids, engineSerialLast4: serialPhoto ? serial : '' }),
      }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok) throw new Error(r ? msg(j.messageKey) : errors.network ?? errors.generic);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card" role="status" style={{ display: 'grid', gap: 12 }}>
        <h2>{L.sentTitle}</h2>
        <p className="muted">{L.sentBody}</p>
        <a className="btn" href={doneHref}>{L.back}</a>
      </div>
    );
  }
  const file = (id: string, label: string, hint: string, set: (f: File | null) => void, value: File | null, required = false) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={id}>{label}{required ? <span aria-hidden="true" style={{ color: 'var(--c-danger)' }}> *</span> : null}</label>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required={required} onChange={(e) => set(e.target.files?.[0] ?? null)} />
      <span className="small muted">{value ? value.name : hint}</span>
    </div>
  );
  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      {file('doc-license', L.license, L.licenseHint, setLicense, license, true)}
      {file('doc-serial-photo', L.serialPhoto, L.serialPhotoHint, setSerialPhoto, serialPhoto)}
      {serialPhoto ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="doc-serial">{L.serial}</label>
          <input id="doc-serial" className="input" maxLength={6} value={serial} onChange={(e) => setSerial(e.target.value)} aria-invalid={serialOk ? undefined : true} />
          {!serialOk ? <span className="small" style={{ color: 'var(--c-danger)' }}>{L.serialInvalid}</span> : null}
        </div>
      ) : null}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
      <button type="button" className="btn" disabled={busy || !license || !serialOk} onClick={() => void send()}>{busy ? L.sending : L.send}</button>
    </div>
  );
}
