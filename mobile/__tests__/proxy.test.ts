// eslint-disable-next-line @typescript-eslint/no-require-imports
const { forwardedFor } = require('../proxy');

test('I-3: istemcinin yazdığı X-Forwarded-For korunur ama gerçek bağlantı adresi her zaman sona eklenir', () => {
  expect(forwardedFor(undefined, '192.168.1.20')).toBe('192.168.1.20');
  expect(forwardedFor('1.2.3.4', '192.168.1.20')).toBe('1.2.3.4, 192.168.1.20');
});

test('tünelden gelen istekte istemcinin sahte adresleri atılır; yalnızca tünelin eklediği son adres kalır', () => {
  // İstemci "1.1.1.1" uydurdu, tünel gerçek adresi (9.9.9.9) sona ekledi, tünel ajanı Metro'ya yerelden bağlandı.
  expect(forwardedFor('1.1.1.1, 9.9.9.9', '127.0.0.1')).toBe('9.9.9.9, 127.0.0.1');
  expect(forwardedFor('1.1.1.1,9.9.9.9', '::1')).toBe('9.9.9.9, ::1');
});
