'use client';

import { useEffect } from 'react';

/** İlan sayfası tarayıcıda açılınca görüntülenmeyi bir kez bildirir (sunucu aynı kişiyi 30 dakika içinde yeniden saymaz). */
export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    fetch('/api/views', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => undefined);
  }, [id]);
  return null;
}
