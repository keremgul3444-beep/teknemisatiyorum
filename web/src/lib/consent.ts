/** Çerez izni: yalnızca zorunlu çerezler varsayılan; istatistik ancak açık izinle (istatistik aracı henüz seçilmedi). */
export type Consent = { necessary: true; analytics: boolean; at: string };
export const CONSENT_COOKIE = 'tms_consent';
export const CONSENT_MAX_AGE = 180 * 24 * 3600;

export const serializeConsent = (c: Consent) => JSON.stringify(c);

export function readConsent(v?: string): Consent | null {
  if (!v) return null;
  try {
    const o = JSON.parse(v.startsWith('%') ? decodeURIComponent(v) : v);
    return o && o.necessary === true && typeof o.analytics === 'boolean' && typeof o.at === 'string'
      ? { necessary: true, analytics: o.analytics, at: o.at }
      : null;
  } catch {
    return null;
  }
}
