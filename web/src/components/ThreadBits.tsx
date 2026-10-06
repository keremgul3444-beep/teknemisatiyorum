'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const act = (id: string, action: 'read' | 'share-phone') =>
  fetch(`/api/messages/${id}/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then((r) => r.ok).catch(() => false);

/** Sohbet açıkken: okundu işaretlenir, sekme görünürken yeni mesajlar için 20 sn'de bir yenilenir. */
export function ThreadLive({ id, lastAt }: { id: string; lastAt: string }) {
  const router = useRouter();
  useEffect(() => { void act(id, 'read'); }, [id, lastAt]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 20_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

/** Numaramı yalnızca bu kişiyle paylaş (ikinci dokunuşla onay). */
export function SharePhone({ id, shared, labels }: { id: string; shared: boolean; labels: { share: string; confirm: string; done: string; cancel: string } }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (shared) return <p className="muted small">{labels.done}</p>;
  if (!sure) return <button type="button" className="linklike" onClick={() => setSure(true)}>{labels.share}</button>;
  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <span className="small">{labels.confirm}</span>
      <button type="button" className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); if (await act(id, 'share-phone')) router.refresh(); setBusy(false); }}>{labels.share}</button>
      <button type="button" className="linklike" onClick={() => setSure(false)}>{labels.cancel}</button>
    </div>
  );
}
