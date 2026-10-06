'use client';
import { useState } from 'react';

const REASONS = ['scam', 'wrong_info', 'sold', 'offensive', 'other'] as const;
type Labels = { action: string; body: string; note: string; notePh: string; send: string; done: string; login: string; loginHint: string; cancel: string; reasons: Record<string, string> };

/** İlanı bildir: gerekçe + isteğe bağlı not; satıcıya gösterilmez, ekip inceler. Oturum yoksa girişe yönlendirir. */
export function ReportListing({ listingId, labels: L, errors, loginHref }: { listingId: string; labels: Labels; errors: Record<string, string>; loginHref: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'login'>('form');
  const [error, setError] = useState('');
  if (!open) return <button type="button" className="linklike small" onClick={() => setOpen(true)}>{L.action}</button>;
  if (state === 'done') return <p className="small muted" role="status">{L.done}</p>;
  const send = async () => {
    setBusy(true); setError('');
    const r = await fetch(`/api/listings/${encodeURIComponent(listingId)}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, note }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 401) { setState('login'); return; }
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
    setState('done');
  };
  return (
    <form className="card" style={{ display: 'grid', gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (reason) void send(); }}>
      <p className="small" style={{ margin: 0 }}>{L.body}</p>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {REASONS.map((k) => (
          <label key={k} className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <input type="radio" name="report-reason" checked={reason === k} onChange={() => setReason(k)} />{L.reasons[k]}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-note" className="small">{L.note}</label>
      <textarea id="report-note" className="input" rows={2} maxLength={500} placeholder={L.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
      {state === 'login'
        ? <p className="small" style={{ margin: 0 }}>{L.loginHint} <a className="btn" href={loginHref}>{L.login}</a></p>
        : <div className="row"><button className="btn" type="submit" disabled={busy || !reason}>{L.send}</button><button type="button" className="linklike" onClick={() => setOpen(false)}>{L.cancel}</button></div>}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </form>
  );
}
