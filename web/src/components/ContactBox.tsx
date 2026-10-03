'use client';
import { useEffect, useState } from 'react';

type Labels = { title: string; placeholder: string; send: string; sent: string; openThread: string; login: string; loginHint: string };

/**
 * Siteden satıcıya mesaj. Oturum yoksa girişe (bu sayfaya geri dönecek şekilde) yönlendirir.
 * Satıcının telefonu gösterilmez; yazışma sitede Hesabım > Mesajlar'da ve uygulamada sürer.
 */
export function ContactBox({ listingId, providerId, labels, errors, loginHref, threadHref, suggestion }: {
  listingId?: string; providerId?: string; labels: Labels; errors: Record<string, string>; loginHref: string; threadHref: string; suggestion: string;
}) {
  // Hazır bir ilk cümleyle açılır; girişe gidip dönen kullanıcının yazdığı metin kaybolmaz (yalnızca bu sekmede tutulur).
  const key = `tms.contact.${listingId ?? providerId}`;
  const [text, setText] = useState(suggestion);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) setText(saved);
    } catch { /* gizli sekme vb. */ }
  }, [key]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [thread, setThread] = useState<string | null>(null);

  const send = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(providerId ? { providerId, text } : { listingId, text }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        try { sessionStorage.setItem(key, text); } catch { /* yok sayılır */ }
        setNeedLogin(true);
        return;
      }
      if (!r.ok) { setError(errors[String(j.messageKey ?? '').replace(/^errors\./, '')] ?? errors.generic); return; }
      setThread(String(j.conversationId));
      setText('');
      try { sessionStorage.removeItem(key); } catch { /* yok sayılır */ }
    } catch {
      setError(errors.network ?? errors.generic);
    } finally {
      setBusy(false);
    }
  };

  if (thread) {
    return (
      <div className="card" role="status">
        <p style={{ margin: 0 }}>{labels.sent}</p>
        <a href={`${threadHref}/${thread}`}>{labels.openThread}</a>
      </div>
    );
  }
  return (
    <form className="card" style={{ display: 'grid', gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(); }}>
      <label htmlFor="contact-text"><strong>{labels.title}</strong></label>
      <textarea id="contact-text" className="input" rows={3} maxLength={2000} value={text} placeholder={labels.placeholder}
        onChange={(e) => setText(e.target.value)} style={{ resize: 'vertical' }} />
      {needLogin ? (
        <p className="small" style={{ margin: 0 }}>{labels.loginHint} <a className="btn" href={loginHref}>{labels.login}</a></p>
      ) : (
        <button className="btn" type="submit" disabled={busy || !text.trim()}>{labels.send}</button>
      )}
      {error ? <p className="small" role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </form>
  );
}
