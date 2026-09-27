'use client';
import { useEffect, useState } from 'react';

type Labels = {
  phone: string; sendCode: string; code: string; verify: string; resend: string; resendIn: string; codeSent: string; betaHint: string;
};

/**
 * Telefonla giriş: kod iste → kodu gir. Anahtarlar sunucu tarafında HttpOnly çereze yazılır; bu bileşen görmez.
 * Kapalı betada dönen deneme kodu yalnızca bellekte tutulur (adres çubuğuna yazılmaz).
 */
export function LoginForm({ labels, errors, next }: { labels: Labels; errors: Record<string, string>; next: string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const msg = (key?: string) => errors[key?.replace(/^errors\./, '') ?? ''] ?? errors.generic;
  const post = async (url: string, body: unknown) => {
    setBusy(true); setError('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(msg(j.messageKey)); return null; }
      return j;
    } catch {
      setError(errors.network ?? errors.generic);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const full = `+90${phone.replace(/\D/g, '').slice(-10)}`;
  const sendCode = async () => {
    const j = await post('/api/auth/otp', { phone: full });
    if (!j) return;
    if (j.devCode) setCode(j.devCode);
    setStep('code'); setLeft(60);
  };
  const verify = async () => {
    const j = await post('/api/auth/verify', { phone: full, code });
    if (j) window.location.assign(next);
  };

  return (
    <div className="card" style={{ maxWidth: 420, display: 'grid', gap: 12 }}>
      {step === 'phone' ? (
        <>
          <label htmlFor="phone">{labels.phone}</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <span className="chip">+90</span>
            <input id="phone" className="input" inputMode="tel" autoComplete="tel-national" placeholder="5xx xxx xx xx" maxLength={13} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn" type="button" disabled={busy || phone.replace(/\D/g, '').length < 10} onClick={sendCode}>{labels.sendCode}</button>
        </>
      ) : (
        <>
          <p className="muted small">{labels.codeSent}</p>
          <label htmlFor="code">{labels.code}</label>
          <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <p className="muted small">{labels.betaHint}</p>
          <button className="btn" type="button" disabled={busy || code.length !== 6} onClick={verify}>{labels.verify}</button>
          <button className="btn ghost" type="button" disabled={busy || left > 0} onClick={sendCode}>{left > 0 ? labels.resendIn.replace('{{s}}', String(left)) : labels.resend}</button>
        </>
      )}
      {error ? <p role="alert" style={{ color: 'var(--c-danger)', margin: 0 }}>{error}</p> : null}
    </div>
  );
}
