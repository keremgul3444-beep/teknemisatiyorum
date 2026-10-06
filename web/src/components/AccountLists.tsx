'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedQuery } from '@tms/shared';

type Dict = Record<string, string>;
const msg = (errors: Dict, j: { messageKey?: string }) => errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic;

/** İlanlar sayfasında "Bu aramayı kaydet": giriş yoksa girişe, dönünce aynı aramaya gelir. */
export function SaveSearchButton({ text, filter, L, errors, loginHref, listHref }: {
  text: string; filter: ParsedQuery; L: { save: string; saved: string; savedLink: string }; errors: Dict; loginHref: string; listHref: string;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');
  const save = async () => {
    setState('busy'); setError('');
    const r = await fetch('/api/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, filter }) }).catch(() => null);
    if (r?.status === 401) { window.location.assign(`${loginHref}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setError(r ? msg(errors, j) : errors.network ?? errors.generic); setState('idle'); return; }
    setState('done');
  };
  if (state === 'done') return <p className="small" role="status" style={{ margin: 0 }}>{L.saved} <a href={listHref}>{L.savedLink}</a></p>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <button type="button" className="btn ghost" disabled={state === 'busy'} onClick={() => void save()} style={{ justifySelf: 'start' }}>{L.save}</button>
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** Kayıtlı arama satırının düğmeleri: sonuçlara git (sayaç sıfırlanır) ve sil. */
export function SavedSearchActions({ id, resultsHref, L, errors }: { id: string; resultsHref: string; L: { see: string; remove: string }; errors: Dict }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const see = async () => {
    await fetch(`/api/saved-searches/${id}`, { method: 'POST' }).catch(() => null);
    window.location.assign(resultsHref);
  };
  const remove = async () => {
    setBusy(true); setError('');
    const r = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(r ? msg(errors, j) : errors.network ?? errors.generic); return; }
    router.refresh();
  };
  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <div className="row">
        <button type="button" className="btn" onClick={() => void see()}>{L.see}</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void remove()}>{L.remove}</button>
      </div>
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** Bildirim sayfası açılınca okunmamışlar okundu yapılır (sayfa bir kez okunmamış vurgusuyla çizilir). */
export function MarkAllRead({ when }: { when: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    void fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => null);
  }, [when]);
  return null;
}

/** Favorilerden 2–3 ilan seçip karşılaştırma sayfasına git. */
export function CompareSelect({ items, href, L }: { items: { id: string; title: string }[]; href: string; L: { cta: string; select: string; hint: string } }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  if (items.length < 2) return null;
  return (
    <fieldset className="card" style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
      <legend className="small muted">{L.hint} {L.select}</legend>
      <div className="row small">
        {items.map((it) => (
          <label key={it.id} className="chip" style={{ gap: 6 }}><input type="checkbox" checked={sel.includes(it.id)} disabled={!sel.includes(it.id) && sel.length >= 3} onChange={() => toggle(it.id)} />{it.title}</label>
        ))}
      </div>
      {sel.length >= 2 ? <a className="btn" href={`${href}?ids=${sel.join(',')}`} style={{ justifySelf: 'start' }}>{L.cta.replace('{{n}}', String(sel.length))}</a> : null}
    </fieldset>
  );
}
