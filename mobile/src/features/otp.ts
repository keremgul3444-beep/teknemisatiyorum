/** Sunucu aynı numaraya dakikada tek kod gönderir; "tekrar gönder" de o kadar bekler. */
export const OTP_RESEND_SECONDS = 60;

// Kapalı betada sunucunun döndürdüğü kod yalnızca bellekte, bir kez okunmak üzere tutulur
// (ekranlar arası adres parametresiyle taşınsaydı web'de adres çubuğuna ve geçmişe düşerdi).
let pending: { phone: string; code: string } | null = null;

export function putDevCode(phone: string, code: string) {
  pending = { phone, code };
}

export function takeDevCode(phone: string): string | undefined {
  if (!pending || pending.phone !== phone) return undefined;
  const { code } = pending;
  pending = null;
  return code;
}
