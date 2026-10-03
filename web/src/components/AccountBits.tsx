'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n';
import { checkoutTarget } from '@/lib/checkout';

/** Çıkış: sunucu oturumu kapatır ve HttpOnly çerezleri siler. */
export function LogoutButton({ label, to }: { label: string; to: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn ghost" type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
      window.location.assign(to);
    }}>{label}</button>
  );
}

const Accepted = createContext(false);

/**
 * Ödeme öncesi onay: ön bilgilendirme formu ve mesafeli satış sözleşmesi okunup onaylanmadan satın alma düğmeleri
 * çalışmaz; onay sunucuya da gönderilir ve sürümüyle kaydedilir.
 */
export function AcceptGate({ label, links, children }: { label: string; links: { href: string; text: string }[]; children: ReactNode }) {
  const [ok, setOk] = useState(false);
  return (
    <Accepted.Provider value={ok}>
      <label className="row" style={{ alignItems: 'flex-start', gap: 8, margin: '12px 0' }}>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 4 }} />
        <span>{label}</span>
      </label>
      <p className="small" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noopener">{l.text}</a>)}
      </p>
      {children}
    </Accepted.Provider>
  );
}

/**
 * Öne çıkarma satın al: sipariş oluşturulur, ödeme sayfasına gidilir. Ödeme adresi yalnızca sitenin kendisi
 * ya da tanımlı ödeme sağlayıcısı olabilir (başka yere yönlendirme yok).
 */
export function BuyButton({ listingId, productCode, label, errors, locale }: { listingId: string; productCode: string; label: string; errors: Record<string, string>; locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accepted = useContext(Accepted);
  const buy = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, productCode, accept: accepted }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
      const url = checkoutTarget(String(j.checkoutUrl ?? ''), window.location.origin, locale, process.env.NEXT_PUBLIC_PAYMENT_ORIGIN);
      if (!url) { setError(errors.generic); return; }
      window.location.assign(url);
    } catch {
      setError(errors.network ?? errors.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button className="btn" type="button" disabled={busy || !accepted} onClick={buy}>{label}</button>
      {error ? <p role="alert" style={{ color: 'var(--c-danger)' }}>{error}</p> : null}
    </div>
  );
}

/** Yalnızca deneme ödemesi: gerçek para çekilmez; sonuç sunucuda imzalı bildirimle işlenir. */
export function DevPayButtons({ orderId, labels, resultHref, errors }: { orderId: string; labels: { success: string; failure: string }; resultHref: string; errors: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pay = async (result: 'success' | 'failure') => {
    setBusy(true); setError('');
    const r = await fetch('/api/odeme/deneme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, result }) }).catch(() => null);
    if (!r?.ok) { setError(errors.generic); setBusy(false); return; }
    window.location.assign(resultHref);
  };
  return (
    <div className="row">
      <button className="btn" type="button" disabled={busy} onClick={() => pay('success')}>{labels.success}</button>
      <button className="btn ghost" type="button" disabled={busy} onClick={() => pay('failure')}>{labels.failure}</button>
      {error ? <p role="alert" style={{ color: 'var(--c-danger)' }}>{error}</p> : null}
    </div>
  );
}

/** Sohbet sayfasında yanıt: gönderince sayfa sunucudan yenilenir (yeni mesaj listede görünür). */
export function ReplyForm({ conversationId, labels, errors }: { conversationId: string; labels: { placeholder: string; send: string }; errors: Record<string, string> }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    setBusy(true); setError('');
    const r = await fetch(`/api/messages/${encodeURIComponent(conversationId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
    setText('');
    router.refresh();
  };
  return (
    <form style={{ display: 'grid', gap: 10, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(); }}>
      <textarea className="input" rows={3} maxLength={2000} value={text} placeholder={labels.placeholder} aria-label={labels.placeholder} onChange={(e) => setText(e.target.value)} />
      <button className="btn" type="submit" disabled={busy || !text.trim()}>{labels.send}</button>
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </form>
  );
}

/** Engelle / engeli kaldır: engellemeden önce bir kez onay ister. */
export function BlockButton({ conversationId, blocked, labels, errors }: {
  conversationId: string; blocked: boolean; labels: { block: string; unblock: string; confirm: string; cancel: string }; errors: Record<string, string>;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (on: boolean) => {
    setBusy(true); setError('');
    const r = await fetch(`/api/messages/${encodeURIComponent(conversationId)}/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setAsking(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
    router.refresh();
  };
  if (blocked) return <button className="btn ghost small" type="button" disabled={busy} onClick={() => void go(false)}>{labels.unblock}</button>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {asking ? (
        <>
          <p className="small" style={{ margin: 0 }}>{labels.confirm}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost small" type="button" onClick={() => setAsking(false)}>{labels.cancel}</button>
            <button className="btn small" type="button" disabled={busy} onClick={() => void go(true)}>{labels.block}</button>
          </div>
        </>
      ) : <button className="linklike small" type="button" onClick={() => setAsking(true)}>{labels.block}</button>}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** İlanı yenile: başarıda sayfa yenilenir; hata yerinde gösterilir. */
export function RenewButton({ listingId, label, errors }: { listingId: string; label: string; errors: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async () => {
    setBusy(true); setError('');
    const r = await fetch(`/api/listings/${encodeURIComponent(listingId)}/renew`, { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
    router.refresh();
  };
  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
      <button className="btn" type="button" disabled={busy} onClick={() => void go()}>{label}</button>
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}
