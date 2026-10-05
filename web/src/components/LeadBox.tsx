'use client';
import { useState } from 'react';

type Kind = 'finance' | 'insurance' | 'transport';
type Labels = Record<'title' | 'intro' | 'finance' | 'insurance' | 'transport' | 'note' | 'consent' | 'send' | 'sent' | 'login' | 'loginHint', string>;

/** İlan sayfasında finansman / sigorta / nakliye teklifi: açık izinle talep; ekip anlaşmalı iş ortağına iletir. */
export function LeadBox({ listingId, labels: L, errors, loginHref }: { listingId: string; labels: Labels; errors: Record<string, string>; loginHref: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('finance');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'form' | 'sent' | 'login'>('form');
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true); setError('');
    const r = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, listingId, note, consent }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.status === 401) { setState('login'); return; }
    if (!r?.ok) { setError(r ? errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic : errors.network ?? errors.generic); return; }
    setState('sent');
  };
  if (!open) return <button type="button" className="btn ghost" onClick={() => setOpen(true)}>{L.title}</button>;
  if (state === 'sent') return <p className="card small" role="status" style={{ margin: 0 }}>{L.sent}</p>;
  return (
    <form className="card" style={{ display: 'grid', gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (consent) void send(); }}>
      <strong>{L.title}</strong>
      <p className="muted small" style={{ margin: 0 }}>{L.intro}</p>
      <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
        {(['finance', 'insurance', 'transport'] as const).map((k) => (
          <label key={k} className="chip" style={{ gap: 6 }}><input type="radio" name="lead-kind" checked={kind === k} onChange={() => setKind(k)} />{L[k]}</label>
        ))}
      </fieldset>
      <label htmlFor="lead-note" className="small">{L.note}</label>
      <textarea id="lead-note" className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="small" style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 8 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3, flex: 'none' }} />
        <span style={{ flex: 1 }}>{L.consent}</span>
      </label>
      {state === 'login'
        ? <p className="small" style={{ margin: 0 }}>{L.loginHint} <a className="btn" href={loginHref}>{L.login}</a></p>
        : <button className="btn" type="submit" disabled={busy || !consent}>{L.send}</button>}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </form>
  );
}
