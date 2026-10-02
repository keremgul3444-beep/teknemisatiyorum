import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(), setNotificationHandler: jest.fn(), AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'proje-1' } } } } }));

import { getPushToken, routeOfResponse } from '@/features/push';

const N = Notifications as unknown as Record<'getPermissionsAsync' | 'requestPermissionsAsync' | 'getExpoPushTokenAsync' | 'setNotificationChannelAsync', jest.Mock>;
beforeEach(() => { jest.clearAllMocks(); Platform.OS = 'android'; });

test('izin verilirse jeton kaydı için Expo jetonu döner', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
  N.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  N.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc123]' });
  expect(await getPushToken()).toEqual({ token: 'ExponentPushToken[abc123]', platform: 'android' });
  expect(N.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proje-1' });
  expect(N.setNotificationChannelAsync).toHaveBeenCalled();
});

test('izin yoksa, web ise ya da jeton alınamazsa null; giriş akışı bozulmaz', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
  N.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
  expect(await getPushToken()).toBeNull();
  expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();

  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  N.getExpoPushTokenAsync.mockRejectedValue(new Error('EAS proje kimliği yok'));
  expect(await getPushToken()).toBeNull();

  Platform.OS = 'web';
  expect(await getPushToken()).toBeNull();
});

test('bildirime dokununca sunucunun yolladığı anahtara göre ekran açılır', () => {
  const resp = (data: unknown) => ({ notification: { request: { content: { data } } } }) as never;
  expect(routeOfResponse(resp({ key: 'notif.priceDrop', params: { listingId: 'l9' } }))).toBe('/ilan/l9');
  expect(routeOfResponse(resp({ key: 'notif.newMessage', params: { conversationId: 'c1' } }))).toBe('/sohbet/c1');
  expect(routeOfResponse(resp({}))).toBeNull();
  expect(routeOfResponse(null)).toBeNull();
});
