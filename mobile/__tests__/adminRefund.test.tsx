import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import i18n from 'i18next';
import AdminSiparisler from '@/app/admin/siparisler';
import { actions } from '@/services';
import { useMode } from '@/services/mode';

const order = {
  id: 'o1', listingId: 'l1', listingTitle: 'Beneteau Oceanis', productCode: 'vitrin_7', channel: 'web',
  userName: 'Ahmet', note: null, status: 'paid', amountKurus: 490000,
};

beforeEach(() => {
  useMode.setState({ mode: 'api' });
  jest.spyOn(actions, 'adminOrders').mockResolvedValue([order] as never);
  jest.spyOn(actions, 'adminRefund').mockResolvedValue(undefined as never);
});
afterEach(() => { jest.restoreAllMocks(); useMode.setState({ mode: 'demo' }); });

const tr = (k: string) => i18n.t(k);

test('iade hemen yapılmaz: önce onay sorulur, vazgeçilirse sunucu çağrılmaz', async () => {
  await render(<AdminSiparisler />);
  await act(async () => { fireEvent.press(await screen.findByText(tr('admin.refund'))); });
  expect(actions.adminRefund).not.toHaveBeenCalled();
  expect(screen.getByText(tr('admin.refundConfirm'))).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText(tr('common.cancel'))); });
  expect(screen.queryByText(tr('admin.refundConfirm'))).toBeNull();
  expect(actions.adminRefund).not.toHaveBeenCalled();
});

test('onaylanınca iade yapılır ve liste yenilenir', async () => {
  await render(<AdminSiparisler />);
  await act(async () => { fireEvent.press(await screen.findByText(tr('admin.refund'))); });
  await act(async () => { fireEvent.press(screen.getByText(tr('admin.refundYes'))); });
  expect(actions.adminRefund).toHaveBeenCalledWith('o1');
  expect(actions.adminOrders).toHaveBeenCalledTimes(2);
});
