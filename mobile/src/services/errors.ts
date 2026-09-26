import i18n from 'i18next';
import { showDemoToast } from '@/components/DemoToast';
import { ApiError } from './api/client';

/** Sunucu hatasını kullanıcının dilinde kısa bir bildirim olarak gösterir. Seviye yönlendirmesi istemcide zaten yapılır. */
export function showError(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 'LEVEL_REQUIRED') return;
    const key = i18n.exists(e.messageKey) ? e.messageKey : 'errors.generic';
    return showDemoToast(i18n.t(key, e.params ?? {}));
  }
  showDemoToast(i18n.t('errors.generic'));
}

/** Eylemi çalıştırır; hata olursa gösterir ve `undefined` döner. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    showError(e);
    return undefined;
  }
}
