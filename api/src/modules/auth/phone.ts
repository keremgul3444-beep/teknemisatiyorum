import { z } from 'zod';

/**
 * Türkiye numaralarını E.164'e (+90XXXXXXXXXX) çevirir: "0532 …", "532 …", "+90 532 …", "90532…" aynı sonucu verir.
 * Diğer ülke numaraları "+" ile yazılmalıdır.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && !digits.startsWith('90')) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  let national = digits;
  if (national.startsWith('90') && national.length === 12) national = national.slice(2);
  if (national.startsWith('0') && national.length === 11) national = national.slice(1);
  return /^[2-5]\d{9}$/.test(national) ? `+90${national}` : null;
}

export const phoneSchema = z.string().max(24).transform((s, ctx) => {
  const p = normalizePhone(s);
  if (!p) {
    ctx.addIssue({ code: 'custom', message: 'phone' });
    return z.NEVER;
  }
  return p;
});
