import type { ComponentType } from 'react';
import { Redirect } from 'expo-router';
import { useMode } from '@/services/mode';

/**
 * 2. dalga ekranları (usta, kaptan, güvenli ödeme) yalnızca demo modunda açılır;
 * gerçek modda yakında ekranına (/yakinda) yönlenir. Kancalar sarılan bileşende kaldığı için kural ihlali olmaz.
 */
export function demoOnly<P extends object>(Inner: ComponentType<P>) {
  return function DemoOnlyScreen(props: P) {
    const mode = useMode((s) => s.mode);
    return mode === 'api' ? <Redirect href="/yakinda" /> : <Inner {...props} />;
  };
}
