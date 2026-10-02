import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { notifTarget } from './notifications';

/**
 * Anlık bildirim kaydı. Yalnızca gerçek cihazda ve izin verilirse Expo jetonu döner; aksi halde null
 * (web, simülatör, izin yok, EAS proje kimliği yok). Hiçbir durumda hata fırlatmaz: giriş akışını bozmasın.
 */
export async function getPushToken(): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (!Device.isDevice) return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Bildirimler', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return { token: data, platform: Platform.OS };
  } catch (e) {
    if (process.env.PUSH_DEBUG) console.warn('push:', e);
    return null;
  }
}

/** Bildirime dokununca gidilecek ekran: sunucunun yolladığı `data.key` + `data.params`. */
export function routeOfResponse(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { key?: string; params?: Record<string, string> } | undefined;
  if (!data?.key) return null;
  return notifTarget(data.key, data.params ?? null);
}

/** Uygulama açıkken gelen bildirim de banner olarak gösterilir. */
export function installForegroundHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}
