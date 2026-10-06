'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Dict = Record<string, string>;

/** Yönetim işlemi: /api/admin altındaki yol çağrılır, başarıda sayfa yenilenir, hata yerinde gösterilir. */
function useAction(errors: Dict) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (path: string, body?: unknown, refresh = true): Promise<false | Record<string, unknown>> => {
    setBusy(true); setError('');
    const r = await fetch(`/api/admin/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return false; }
    if (refresh) router.refresh();
    return j;
  };
  return { busy, error, run };
}

const Err = ({ text }: { text: string }) => (text ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{text}</p> : null);

/** Onay kuyruğu: onayla ya da gerekçeyle reddet. Karar moderatörün gördüğü sürüme bağlıdır. */
export function ListingDecision({ id, version, L, reasons, errors }: { id: string; version: string; L: Dict; reasons: Dict; errors: Dict }) {
  const a = useAction(errors);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rejecting ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <input className="input" aria-label={L.rejectNote} placeholder={L.rejectNote} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          <div className="row">
            {Object.entries(reasons).map(([k, label]) => (
              <button key={k} type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`listings/${id}/decision`, { decision: 'reject', reason: k, version, note })}>{label}</button>
            ))}
            <button type="button" className="linklike" onClick={() => setRejecting(false)}>{L.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn" disabled={a.busy} onClick={() => void a.run(`listings/${id}/decision`, { decision: 'approve', version })}>{L.approve}</button>
          <button type="button" className="btn ghost" disabled={a.busy} onClick={() => setRejecting(true)}>{L.reject}</button>
        </div>
      )}
      <Err text={a.error} />
    </div>
  );
}

/** Belge başvurusu: onayla ya da gerekçeyle reddet. */
export function DocDecision({ id, L, reasons, errors }: { id: string; L: Dict; reasons: Dict; errors: Dict }) {
  const a = useAction(errors);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rejecting ? <input className="input" aria-label={L.rejectNote} placeholder={L.rejectNote} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /> : null}
      <div className="row">
        {rejecting
          ? Object.entries(reasons).map(([k, label]) => (
            <button key={k} type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`verifications/${id}/decision`, { decision: 'reject', reason: k, note })}>{label}</button>
          ))
          : <>
            <button type="button" className="btn" disabled={a.busy} onClick={() => void a.run(`verifications/${id}/decision`, { decision: 'approve' })}>{L.approve}</button>
            <button type="button" className="btn ghost" onClick={() => setRejecting(true)}>{L.reject}</button>
          </>}
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Bildirilen ilan: gerekçeyle kaldır, bildirimleri yoksay ya da satıcıyı askıya al. */
export function ReportActions({ listingId, ownerId, suspended, L, takedown, errors }: {
  listingId: string; ownerId: string; suspended: boolean; L: Dict; takedown: Dict; errors: Dict;
}) {
  const a = useAction(errors);
  const [mode, setMode] = useState<null | 'takedown' | 'suspend'>(null);
  const [reason, setReason] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {mode === 'takedown' ? (
        <div className="row">
          {Object.entries(takedown).map(([k, label]) => (
            <button key={k} type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`listings/${listingId}/takedown`, { reason: k })}>{label}</button>
          ))}
          <button type="button" className="linklike" onClick={() => setMode(null)}>{L.cancel}</button>
        </div>
      ) : mode === 'suspend' ? (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" aria-label={L.suspendReason} placeholder={L.suspendReason} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className="btn" disabled={a.busy || reason.trim().length < 3} onClick={() => void a.run(`users/${ownerId}/suspend`, { reason })}>{L.suspend}</button>
          <button type="button" className="linklike" onClick={() => setMode(null)}>{L.cancel}</button>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn" onClick={() => setMode('takedown')}>{L.takedown}</button>
          <button type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`listings/${listingId}/reports/dismiss`)}>{L.dismiss}</button>
          {!suspended ? <button type="button" className="btn ghost" onClick={() => setMode('suspend')}>{L.suspendSeller}</button> : null}
        </div>
      )}
      <Err text={a.error} />
    </div>
  );
}

/** Kullanıcı listesinde askıya al / askıyı kaldır. */
export function UserSuspend({ id, suspended, L, errors }: { id: string; suspended: boolean; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  if (suspended) return <div style={{ display: 'grid', gap: 6 }}><button type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`users/${id}/unsuspend`)}>{L.unsuspend}</button><Err text={a.error} /></div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {asking ? (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" aria-label={L.suspendReason} placeholder={L.suspendReason} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className="btn" disabled={a.busy || reason.trim().length < 3} onClick={() => void a.run(`users/${id}/suspend`, { reason })}>{L.suspend}</button>
        </div>
      ) : <button type="button" className="linklike" onClick={() => setAsking(true)}>{L.suspend}</button>}
      <Err text={a.error} />
    </div>
  );
}

/** Emanet ödeme: iade ya da hizmet verene aktarma (anlaşmazlık kararı). İkisi de geri alınamaz, ikinci dokunuşla onaylanır. */
export function PaymentDecision({ id, L, errors }: { id: string; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  const [sure, setSure] = useState<'refund' | 'release' | null>(null);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="row">
        {sure
          ? <><button type="button" className="btn" disabled={a.busy} onClick={() => void a.run(`service-payments/${id}/${sure}`)}>{sure === 'refund' ? L.refund : L.release}</button>
            <button type="button" className="linklike" onClick={() => setSure(null)}>{L.cancel}</button></>
          : <><button type="button" className="btn ghost" onClick={() => setSure('refund')}>{L.refund}</button>
            <button type="button" className="btn ghost" onClick={() => setSure('release')}>{L.release}</button></>}
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Teklif talebinin numarası: maskeli gelir, "göster" tam numarayı açar (kayda geçer). */
export function LeadPhone({ id, masked, L, errors }: { id: string; masked: string | null; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  const [phone, setPhone] = useState<string | null>(null);
  if (!masked) return <span>—</span>;
  if (phone) return <a href={`tel:${phone}`}>{phone}</a>;
  return (
    <span>{masked} <button type="button" className="linklike" disabled={a.busy} onClick={async () => { const j = await a.run(`leads/${id}/reveal`, undefined, false); if (j) setPhone(String(j.phone ?? '')); }}>{L.revealPhone}</button><Err text={a.error} /></span>
  );
}

/** Teklif talebi: iş ortağına iletildi / kapandı. */
export function LeadStatus({ id, status, L, errors }: { id: string; status: string; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="row">
        {status === 'new' ? <button type="button" className="btn" disabled={a.busy} onClick={() => void a.run(`leads/${id}/status`, { status: 'forwarded' })}>{L.forward}</button> : null}
        {status !== 'closed' ? <button type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`leads/${id}/status`, { status: 'closed' })}>{L.close}</button> : null}
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Ekip rolleri (yalnızca yöneticiye gösterilir): moderatör / yönetici aç-kapa. */
export function UserRoles({ id, roles, L, errors }: { id: string; roles: string[]; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  const staff: string[] = roles.filter((r) => r === 'moderator' || r === 'admin');
  const toggle = (r: string) => a.run(`users/${id}/roles`, { roles: staff.includes(r) ? staff.filter((x) => x !== r) : [...staff, r] });
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="row">
        {(['moderator', 'admin'] as const).map((r) => (
          <button key={r} type="button" className={staff.includes(r) ? 'btn' : 'btn ghost'} aria-pressed={staff.includes(r)} disabled={a.busy} onClick={() => void toggle(r)}>{L[`role_${r}`]}</button>
        ))}
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Ekibin kaldırdığı ilanı yeniden onaya al. */
export function ListingRestore({ id, L, errors }: { id: string; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  return <span><button type="button" className="linklike" disabled={a.busy} onClick={() => void a.run(`listings/${id}/restore`)}>{L.restore}</button><Err text={a.error} /></span>;
}

/** Yorumu gizle / geri aç. */
export function ReviewToggle({ id, hidden, L, errors }: { id: string; hidden: boolean; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  return <span><button type="button" className="btn ghost" disabled={a.busy} onClick={() => void a.run(`reviews/${id}/${hidden ? 'show' : 'hide'}`)}>{hidden ? L.showReview : L.hideReview}</button><Err text={a.error} /></span>;
}

/** Hizmet profilini durdur / aç. */
export function ProviderToggle({ id, status, L, errors }: { id: string; status: string; L: Dict; errors: Dict }) {
  const a = useAction(errors);
  if (status === 'pending') return null;
  const next = status === 'active' ? 'suspended' : 'active';
  return <span><button type="button" className="linklike" disabled={a.busy} onClick={() => void a.run(`providers/${id}/status`, { status: next })}>{next === 'suspended' ? L.pauseProvider : L.activateProvider}</button><Err text={a.error} /></span>;
}

/** Döviz kuru (yalnızca yönetici): 1 birim = ? TL. */
export function FxRate({ currency, rate, L, errors }: { currency: string; rate: number; L: Dict; errors: Dict }) {
  const router = useRouter();
  const [v, setV] = useState(String(rate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    const r = await fetch(`/api/admin/fx/${currency}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rateToTry: Number(v.replace(',', '.')) }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
    router.refresh();
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div className="row" style={{ alignItems: 'center' }}>
        <label htmlFor={`fx-${currency}`} style={{ minWidth: 48, fontWeight: 700 }}>{currency}</label>
        <input id={`fx-${currency}`} className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 160 }} />
        <button type="button" className="btn" disabled={busy || !(Number(v.replace(',', '.')) > 0)} onClick={() => void save()}>{L.save}</button>
      </div>
      <Err text={error} />
    </div>
  );
}
