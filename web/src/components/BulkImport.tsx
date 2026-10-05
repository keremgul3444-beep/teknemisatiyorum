'use client';
import { useEffect, useRef, useState } from 'react';
import { decodeCsv, MAX_CSV } from '@/lib/bulkImport';

type Dict = Record<string, string>;
type RowError = { row: number; field: string; code: string };
type Preview = { valid: number; errors: RowError[]; missing: string[] };
type Job = { id: string; status: string; total: number; created: number; processed: number; failed: { row: number; error?: string }[] };

/**
 * Firma toplu ilan yüklemesi: dosya seç → önizleme (satır hataları) → başlat → durum (birkaç saniyede bir) → sonuç.
 * Excel'de "Farklı kaydet → CSV UTF-8" ya da eski "CSV (noktalı virgülle ayrılmış)" ikisi de okunur.
 */
export function BulkImport({ companyId, L, fields, errors, listingsHref }: { companyId: string; L: Dict; fields: Dict; errors: Dict; listingsHref: string }) {
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const msg = (j: { messageKey?: string; params?: Record<string, unknown> }) => {
    const text = errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic;
    return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(j.params?.[k] ?? ''));
  };
  const call = async (url: string, init?: RequestInit) => {
    const r = await fetch(url, init).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) throw new Error(r ? msg(j) : errors.network ?? errors.generic);
    return j;
  };
  // Metin açıkça verilir: dosya seçildiği anda durum (csv) henüz güncellenmemiş olur.
  const post = (url: string, text: string) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: text }) });

  const pick = async (file: File | undefined) => {
    setPreview(null); setJob(null); setError('');
    if (!file) return;
    const text = decodeCsv(await file.arrayBuffer());
    if (text.length > MAX_CSV) { setError(L.tooLarge); return; }
    setCsv(text); setName(file.name);
    setBusy(true);
    try { setPreview(await post(`/api/firma/${companyId}/import/preview`, text)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const poll = (id: string) => {
    timer.current = setInterval(async () => {
      try {
        const j: Job = await call(`/api/firma/${companyId}/import/${id}`);
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') { clearInterval(timer.current!); timer.current = null; }
      } catch { /* bir sonraki turda yeniden denenir */ }
    }, 3000);
  };
  const start = async () => {
    setBusy(true); setError('');
    try { const j: Job = await post(`/api/firma/${companyId}/import`, csv); setJob(j); poll(j.id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const errText = (code: string) => {
    const [kind, detail] = code.split(':');
    if (kind === 'photo') return L[`photo_${detail}`] ?? L.photo_failed;
    if (kind === 'field') return `${fields[detail] ?? detail}: ${L.err_invalid}`;
    if (!detail) return L[kind] ?? errors.generic;
    return `${fields[kind] ?? kind}: ${L[`err_${detail}`] ?? detail}`;
  };

  if (job) {
    const done = job.status === 'done';
    return (
      <div className="card" role="status" style={{ display: 'grid', gap: 12 }}>
        <h2>{done ? L.doneTitle : L.runningTitle}</h2>
        <p>{L.progress.replace('{{processed}}', String(job.processed)).replace('{{total}}', String(job.total)).replace('{{created}}', String(job.created))}</p>
        {done && job.failed.length ? (
          <>
            <h3>{L.failedTitle}</h3>
            <ul className="small">{job.failed.map((f) => <li key={f.row}>{L.row.replace('{{n}}', String(f.row))}: {(f.error ?? '').split(',').map(errText).join(' · ')}</li>)}</ul>
          </>
        ) : null}
        {done ? <p className="muted small">{L.doneNote}</p> : null}
        {done ? <a className="btn" href={listingsHref}>{L.toListings}</a> : null}
      </div>
    );
  }
  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        <li>{L.step1} <a href="/api/firma/import-template">{L.template}</a></li>
        <li>{L.step2}</li>
        <li>{L.step3}</li>
      </ol>
      <label className="btn ghost" style={{ justifySelf: 'start' }}>
        {name || L.choose}
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {busy ? <p className="small muted" role="status">{L.checking}</p> : null}
      {preview ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {preview.missing.length ? <p role="alert" style={{ color: 'var(--c-danger)' }}>{L.missing.replace('{{cols}}', preview.missing.map((m) => fields[m] ?? m).join(', '))}</p> : (
            <>
              <p><strong>{L.valid.replace('{{n}}', String(preview.valid))}</strong>{preview.errors.length ? ` · ${L.invalidRows.replace('{{n}}', String(new Set(preview.errors.map((e) => e.row)).size))}` : ''}</p>
              {preview.errors.length ? (
                <ul className="small" style={{ maxHeight: 220, overflow: 'auto' }}>
                  {preview.errors.slice(0, 100).map((e, i) => <li key={i}>{L.row.replace('{{n}}', String(e.row))}: {errText(`${e.field}:${e.code}`)}</li>)}
                </ul>
              ) : null}
              <button type="button" className="btn" disabled={busy || preview.valid === 0} onClick={() => void start()} style={{ justifySelf: 'start' }}>
                {L.start.replace('{{n}}', String(preview.valid))}
              </button>
            </>
          )}
        </div>
      ) : null}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}
