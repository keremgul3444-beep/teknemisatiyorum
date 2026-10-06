'use client';
import { useState } from 'react';

type Prefs = { notifyMessages: boolean; notifyMatches: boolean; notifyMarketing: boolean; phoneVisible: boolean; marketingConsent: boolean };
type L = Record<string, string>;

async function patch(body: unknown, errors: L): Promise<string> {
  const r = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (r?.ok) return '';
  const j = r ? await r.json().catch(() => ({})) : {};
  return errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic;
}

/** Hesap ayarları: ad (kimlik doğrulanmadıysa), bildirim ve gizlilik tercihleri; her değişiklik hemen kaydedilir. */
export function SettingsForm({ name, canEditName, prefs, L, errors }: { name: string; canEditName: boolean; prefs: Prefs; L: L; errors: L }) {
  const [p, setP] = useState(prefs);
  const [n, setN] = useState(name);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const toggle = async (k: keyof Prefs) => {
    const next = { ...p, [k]: !p[k] };
    // Pazarlama izni geri alınınca pazarlama bildirimi de kapanır (sunucudaki kuralın aynısı).
    if (k === 'marketingConsent' && !next.marketingConsent) next.notifyMarketing = false;
    setP(next); setError(''); setMsg('');
    const e = await patch({ prefs: { [k]: next[k], ...(k === 'marketingConsent' ? { notifyMarketing: next.notifyMarketing } : {}) } }, errors);
    if (e) { setP(p); setError(e); } else setMsg(L.saved);
  };
  const rows: [keyof Prefs, string][] = [['notifyMessages', L.notifyMessages], ['notifyMatches', L.notifyMatches], ['phoneVisible', L.phoneVisible], ['marketingConsent', L.marketingConsent], ['notifyMarketing', L.notifyMarketing]];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {canEditName ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="name">{L.name}</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="name" className="input" value={n} maxLength={80} onChange={(e) => setN(e.target.value)} />
            <button type="button" className="btn ghost" disabled={!n.trim() || n.trim() === name} onClick={async () => { setError(''); const e = await patch({ name: n.trim() }, errors); if (e) setError(e); else setMsg(L.saved); }}>{L.save}</button>
          </div>
        </div>
      ) : null}
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        <legend style={{ fontWeight: 700, marginBottom: 6 }}>{L.prefsTitle}</legend>
        {rows.map(([k, label]) => (
          <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap', opacity: k === 'notifyMarketing' && !p.marketingConsent ? 0.5 : 1 }}>
            <input type="checkbox" checked={p[k]} disabled={k === 'notifyMarketing' && !p.marketingConsent} onChange={() => void toggle(k)} style={{ marginTop: 4 }} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {msg ? <p className="small muted" role="status" style={{ margin: 0 }}>{msg}</p> : null}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** Hesabı sil: yazılı onay ("SİL") ister; sonra ana sayfaya döner. */
export function DeleteAccount({ L, errors, to }: { L: L; errors: L; to: string }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open) return <button type="button" className="linklike" style={{ color: 'var(--c-danger)' }} onClick={() => setOpen(true)}>{L.deleteAccount}</button>;
  return (
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <p className="small" style={{ margin: 0 }}>{L.deleteWarn}</p>
      <label htmlFor="del">{L.deleteType}</label>
      <input id="del" className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
      <div className="row">
        <button type="button" className="btn" disabled={busy || word.trim().toLocaleUpperCase('tr-TR') !== L.deleteWord} onClick={async () => {
          setBusy(true); setError('');
          const r = await fetch('/api/me', { method: 'DELETE' }).catch(() => null);
          if (r?.ok) { window.location.assign(to); return; }
          const j = r ? await r.json().catch(() => ({})) : {};
          setBusy(false); setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic);
        }}>{L.deleteConfirm}</button>
        <button type="button" className="linklike" onClick={() => { setOpen(false); setWord(''); }}>{L.cancel}</button>
      </div>
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}
