import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import i18n from 'i18next';
import { Field } from '@/components/Field';
import { UploadBox } from '@/components/UploadBox';

beforeAll(() => i18n.changeLanguage('tr'));

test('zorunlu alan "zorunlu" diye adlandırılır; yıldız ve görünen etiket ayrıca okunmaz; hata ipucu olur', async () => {
  await render(<Field label="Marka" value="" onChangeText={() => {}} required error="Bu alan zorunlu." />);
  const input = screen.getByLabelText('Marka, zorunlu');
  expect(input.props.accessibilityHint).toBe('Bu alan zorunlu.');
  // Görünen etiket erişilebilirlik ağacında yok; yalnızca gizlileri de arayınca bulunur.
  expect(screen.queryByText('MARKA', { exact: false })).toBeNull();
  expect(screen.getByText('MARKA', { exact: false, includeHiddenElements: true })).toBeTruthy();
});

test('yükleme kutusu düğmedir; adı durumu da söyler; gönderimden önce "İncelemede" değil "Eklendi"', async () => {
  await render(<UploadBox label="Ruhsat" state="eklendi" onPress={() => {}} />);
  expect(screen.getByRole('button', { name: 'Ruhsat, Eklendi' })).toBeTruthy();
  expect(screen.queryByText('İncelemede')).toBeNull();
});
