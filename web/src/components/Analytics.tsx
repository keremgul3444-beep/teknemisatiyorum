'use client';
import { useEffect } from 'react';
import { CONSENT_COOKIE, readConsent } from '@/lib/consent';

/** Çerez izni değişince yayılan olay (izin çubuğu "Kabul et"te gönderir). */
export const CONSENT_EVENT = 'tms:consent';

/**
 * Ziyaretçi ölçümü (Umami, kendi sunucumuzda): yalnızca çerez izninde "istatistik" kabul edildiyse ve ayar varsa
 * yüklenir. Betik ve gönderim sitenin kendi adresinden (`/stats`, Umami'ye aktarılır): dış alan adı yok.
 */
export function Analytics() {
  useEffect(() => {
    const load = async () => {
      if (document.getElementById('umami')) return;
      const raw = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
      if (!readConsent(raw)?.analytics) return;
      const cfg = await fetch('/api/analytics-config').then((r) => r.json()).catch(() => null);
      if (!cfg?.websiteId || document.getElementById('umami')) return;
      const s = document.createElement('script');
      s.id = 'umami';
      s.defer = true;
      s.src = '/stats/script.js';
      s.dataset.websiteId = cfg.websiteId;
      s.dataset.hostUrl = '/stats';
      document.head.appendChild(s);
    };
    void load();
    window.addEventListener(CONSENT_EVENT, load);
    return () => window.removeEventListener(CONSENT_EVENT, load);
  }, []);
  return null;
}
