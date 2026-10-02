import { paymentRisk } from '../src/safety';

test('IBAN ve ödeme istekleri işaretlenir', () => {
  expect(paymentRisk('IBAN: TR33 0006 1005 1978 6457 8413 26')).toBe(true);
  expect(paymentRisk('tr330006100519786457841326 hesabına atın')).toBe(true);
  expect(paymentRisk('Tekneyi ayırmak için Kapora gönderirseniz tutarım')).toBe(true);
  expect(paymentRisk('Ön ödeme ile rezerve edebilirim')).toBe(true);
  expect(paymentRisk('Please send a deposit via Western Union')).toBe(true);
  expect(paymentRisk('DE89 3704 0044 0532 0130 00')).toBe(true);
  expect(paymentRisk('IBAN numaramı atayım mı?')).toBe(true);
});

test('olağan mesajlar işaretlenmez', () => {
  expect(paymentRisk('Merhaba, tekne hâlâ satılık mı? Cumartesi Bodrum’da görebilir miyim?')).toBe(false);
  expect(paymentRisk('Motor 850 saatte, son bakım 2025 Mayıs')).toBe(false);
  expect(paymentRisk('Telefonum 0532 123 45 67')).toBe(false);
  expect(paymentRisk('Fiyatta pazarlık payı var mı?')).toBe(false);
});
