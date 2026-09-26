// eslint-disable-next-line @typescript-eslint/no-require-imports
const { forwardedFor } = require('../proxy');

test('I-3: istemcinin yazdığı X-Forwarded-For korunur ama gerçek bağlantı adresi her zaman sona eklenir', () => {
  expect(forwardedFor(undefined, '192.168.1.20')).toBe('192.168.1.20');
  expect(forwardedFor('1.2.3.4', '192.168.1.20')).toBe('1.2.3.4, 192.168.1.20');
});
