import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import i18n from 'i18next';
import AdminSikayetler from '@/app/admin/sikayetler';
import { actions } from '@/services';
import { useStore } from '@/services/store';

const tr = (k: string, o?: Record<string, unknown>) => i18n.t(k, o);

beforeEach(() => useStore.getState().resetDemo());

test('demo: bildirilen ilan kuyrukta görünür; kaldırma gerekçe sorar ve ilanı kapatır', async () => {
  const l = useStore.getState().listings.find((x) => x.status === 'yayinda')!;
  await actions.reportListing(l.id, 'scam', 'IBAN istedi');
  await render(<AdminSikayetler />);
  expect(screen.getByText(tr('admin.reportCount', { count: 1 }))).toBeTruthy();
  expect(screen.getByText('IBAN istedi')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText(tr('admin.takedown'))); });
  // Geri alınamaz işlem: önce gerekçe seçilir.
  expect(useStore.getState().listings.find((x) => x.id === l.id)!.status).toBe('yayinda');
  await act(async () => { fireEvent.press(screen.getByText(tr('admin.takedownReasons.scam'))); });
  expect(useStore.getState().listings.find((x) => x.id === l.id)).toMatchObject({ status: 'kaldirildi', removedReason: 'scam' });
  expect(screen.getByText(tr('admin.reportsEmpty'))).toBeTruthy();
});
