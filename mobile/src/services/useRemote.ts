import { useCallback, useEffect, useRef, useState } from 'react';
import { useMode } from './mode';
import { attempt } from './errors';

/**
 * Gerçek modda ekranın verisini sunucudan çeker; demo modunda hiçbir şey yapmaz (`data` null kalır,
 * ekran yerel depoyu kullanır). `reload` bir eylemden sonra listeyi tazelemek içindir.
 * `loading`: ilk yükleme sürüyor (ekran bu sırada "boş" göstermesin); hata olursa kalkar.
 */
export function useRemote<T>(load: () => Promise<T>) {
  const mode = useMode((s) => s.mode);
  const [data, setData] = useState<T | null>(null);
  const [settled, setSettled] = useState(false);
  const latest = useRef(load);
  useEffect(() => { latest.current = load; });
  useEffect(() => {
    if (mode !== 'api') return;
    let live = true;
    attempt(() => latest.current()).then((r) => { if (!live) return; if (r !== undefined) setData(r); setSettled(true); });
    return () => { live = false; };
  }, [mode]);
  const reload = useCallback(async () => {
    if (mode !== 'api') return;
    const r = await attempt(() => latest.current());
    if (r !== undefined) setData(r);
  }, [mode]);
  return { data, reload, loading: mode === 'api' && !settled };
}
