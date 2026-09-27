'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONSENT_COOKIE, CONSENT_MAX_AGE, readConsent, serializeConsent } from '@/lib/consent';

type Labels = { title: string; text: string; necessaryOnly: string; accept: string; more: string; moreHref: string };

/**
 * Çerez izni çubuğu. Varsayılan ve öne çıkan seçenek "yalnızca zorunlu"; istatistik aracı seçilene kadar
 * "kabul et" de hiçbir izleme betiği yüklemez, yalnızca tercihi kaydeder.
 */
export function CookieConsent({ labels }: { labels: Labels }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
    if (!readConsent(raw)) setOpen(true);
  }, []);
  if (!open) return null;
  const save = (analytics: boolean) => {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent({ necessary: true, analytics, at: new Date().toISOString() }))}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
    setOpen(false);
  };
  return (
    <div role="dialog" aria-label={labels.title} aria-live="polite" className="card" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 50, maxWidth: 720, margin: '0 auto', boxShadow: '0 8px 30px rgba(0,0,0,.12)' }}>
      <p className="small" style={{ marginBottom: 12 }}>{labels.text} <Link href={labels.moreHref}>{labels.more}</Link></p>
      <div className="row">
        <button className="btn" type="button" onClick={() => save(false)}>{labels.necessaryOnly}</button>
        <button className="btn ghost" type="button" onClick={() => save(true)}>{labels.accept}</button>
      </div>
    </div>
  );
}
