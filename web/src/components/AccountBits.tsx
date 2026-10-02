'use client';
import { useState } from 'react';
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

/**
 * Öne çıkarma satın al: sipariş oluşturulur, ödeme sayfasına gidilir. Ödeme adresi yalnızca sitenin kendisi
 * ya da tanımlı ödeme sağlayıcısı olabilir (başka yere yönlendirme yok).
 */
export function BuyButton({ listingId, productCode, label, errors, locale }: { listingId: string; productCode: string; label: string; errors: Record<string, string>; locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const buy = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, productCode }) });
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
      <button className="btn" type="button" disabled={busy} onClick={buy}>{label}</button>
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
