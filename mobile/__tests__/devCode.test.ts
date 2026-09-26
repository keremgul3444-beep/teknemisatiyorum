import { putDevCode, takeDevCode, OTP_RESEND_SECONDS } from '@/features/otp';

test('kapalı beta kodu adres çubuğuna değil belleğe konur ve bir kez okunur', () => {
  putDevCode('+905551112233', '123456');
  expect(takeDevCode('+905559999999')).toBeUndefined();
  expect(takeDevCode('+905551112233')).toBe('123456');
  expect(takeDevCode('+905551112233')).toBeUndefined();
});

test('tekrar gönder süresi sunucunun 60 sn kuralıyla aynı', () => {
  expect(OTP_RESEND_SECONDS).toBe(60);
});
