import { appPathFor } from '@/features/deepLink';

/** Expo Router: sistemden gelen bağlantı (site adresi) uygulama yoluna çevrilir. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return appPathFor(path);
}
