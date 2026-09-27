'use client';
import { useState } from 'react';

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
export function BuyButton({ listingId, productCode, label, errors }: { listingId: string; productCode: string; label: string; errors: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const buy = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, productCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
      const url = new URL(j.checkoutUrl, window.location.href);
      const allowed = [window.location.origin, process.env.NEXT_PUBLIC_PAYMENT_ORIGIN].filter(Boolean);
      if (!allowed.includes(url.origin)) { setError(errors.generic); return; }
      window.location.assign(url.toString());
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
