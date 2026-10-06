'use client';
import { useState } from 'react';

/** Paylaş: telefonda sistemin paylaşım sayfası, masaüstünde bağlantı panoya kopyalanır. */
export function ShareButton({ url, title, labels }: { url: string; title: string; labels: { share: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await nav.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => undefined);
  };
  return <button type="button" className="btn ghost" onClick={() => void share()} aria-live="polite">{copied ? labels.copied : labels.share}</button>;
}
