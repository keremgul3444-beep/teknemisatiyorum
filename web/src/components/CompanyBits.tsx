'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Dict = Record<string, string>;
const KINDS = ['galeri', 'broker', 'tersane', 'servis'] as const;

function useCall(errors: Dict) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const call = async (url: string, method: string, body?: unknown) => {
    setBusy(true); setError('');
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return null; }
    router.refresh();
    return j;
  };
  return { busy, error, call };
}
const Err = ({ text }: { text: string }) => (text ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{text}</p> : null);

/** Firma hesabı aç: ad, tür, şehir. */
export function CreateCompany({ L, kinds, errors }: { L: Dict; kinds: Dict; errors: Dict }) {
  const c = useCall(errors);
  const [f, setF] = useState({ name: '', kind: 'galeri', city: '' });
  return (
    <form className="card" style={{ display: 'grid', gap: 12, maxWidth: 520 }} onSubmit={(e) => { e.preventDefault(); void c.call('/api/firma', 'POST', f); }}>
      <h2>{L.createTitle}</h2>
      <label style={{ display: 'grid', gap: 6 }}>{L.name}<input className="input" required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></label>
      <label style={{ display: 'grid', gap: 6 }}>{L.kind}
        <select className="input" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))}>{KINDS.map((k) => <option key={k} value={k}>{kinds[k]}</option>)}</select>
      </label>
      <label style={{ display: 'grid', gap: 6 }}>{L.city}<input className="input" required minLength={2} maxLength={40} value={f.city} onChange={(e) => setF((s) => ({ ...s, city: e.target.value }))} /></label>
      <button className="btn" type="submit" disabled={c.busy}>{L.create}</button>
      <Err text={c.error} />
    </form>
  );
}

/** Personel ekle: telefon ve rol (yönetici ya da personel). */
export function AddMember({ companyId, L, errors }: { companyId: string; L: Dict; errors: Dict }) {
  const c = useCall(errors);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const full = `+90${phone.replace(/\D/g, '').slice(-10)}`;
  return (
    <form style={{ display: 'grid', gap: 8 }} onSubmit={async (e) => { e.preventDefault(); if (await c.call(`/api/firma/${companyId}/members`, 'POST', { phone: full, role })) setPhone(''); }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <span className="chip">+90</span>
        <input className="input" inputMode="tel" aria-label={L.phone} placeholder="5xx xxx xx xx" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <select className="input" aria-label={L.role} value={role} style={{ width: 130 }} onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}>
          <option value="staff">{L.role_staff}</option>
          <option value="admin">{L.role_admin}</option>
        </select>
      </div>
      <button className="btn ghost" type="submit" disabled={c.busy || phone.replace(/\D/g, '').length < 10}>{L.add}</button>
      <p className="muted small" style={{ margin: 0 }}>{L.addHint}</p>
      <Err text={c.error} />
    </form>
  );
}

/** Personeli çıkar (ikinci dokunuşla onay). */
export function RemoveMember({ companyId, userId, L, errors }: { companyId: string; userId: string; L: Dict; errors: Dict }) {
  const c = useCall(errors);
  const [sure, setSure] = useState(false);
  return (
    <span className="row small">
      {sure
        ? <><button type="button" className="btn ghost" disabled={c.busy} onClick={() => void c.call(`/api/firma/${companyId}/members/${userId}`, 'DELETE')}>{L.removeYes}</button>
          <button type="button" className="linklike" onClick={() => setSure(false)}>{L.cancel}</button></>
        : <button type="button" className="linklike" onClick={() => setSure(true)}>{L.remove}</button>}
      <Err text={c.error} />
    </span>
  );
}
