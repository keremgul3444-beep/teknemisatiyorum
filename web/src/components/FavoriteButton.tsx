'use client';
import { useEffect, useState } from 'react';

/** Favoriye ekle/çıkar. İlk durum sunucudan okunur; oturum yoksa tıklayınca girişe gider. */
export function FavoriteButton({ id, labels, loginHref }: { id: string; labels: { add: string; remove: string }; loginHref: string }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/favorites?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((j) => { if (live) setOn(!!j.favorited); }).catch(() => undefined);
    return () => { live = false; };
  }, [id]);
  const toggle = async () => {
    setBusy(true);
    const r = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, on: !on }) }).catch(() => null);
    setBusy(false);
    if (r?.status === 401) { window.location.assign(loginHref); return; }
    if (r?.ok) setOn(!on);
  };
  return (
    <button className="btn ghost" type="button" aria-pressed={on} disabled={busy} onClick={toggle}>
      <span aria-hidden="true">{on ? '♥' : '♡'}</span> {on ? labels.remove : labels.add}
    </button>
  );
}
