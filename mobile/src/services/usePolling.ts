import { useEffect, useRef } from 'react';
import { useMode } from './mode';

/**
 * Gerçek modda `fn`'i `ms` aralıkla çağırır (ör. açık sohbette yeni mesajlar). Önceki çağrı bitmeden
 * yenisi başlamaz; hatalar sessizce yutulur (her turda hata kutusu açılmasın), sonraki turda tekrar denenir.
 */
export function usePolling(fn: () => Promise<unknown>, ms: number) {
  const mode = useMode((s) => s.mode);
  const latest = useRef(fn);
  useEffect(() => { latest.current = fn; });
  useEffect(() => {
    if (mode !== 'api') return;
    let busy = false;
    const h = setInterval(() => {
      if (busy) return;
      busy = true;
      latest.current().catch(() => {}).finally(() => { busy = false; });
    }, ms);
    return () => clearInterval(h);
  }, [mode, ms]);
}
