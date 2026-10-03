import { z } from 'zod';
import { AppError } from './errors';

/**
 * Ön bilgilendirme formu ve mesafeli satış sözleşmesinin yürürlükteki sürümü (metinler sitede /on-bilgilendirme
 * ve /mesafeli-satis). Metin değişince tarih güncellenir; her ödeme hangi sürümün onaylandığını işlem kaydına yazar.
 */
export const LEGAL_VERSION = '2026-10-03';

/** Ödeme başlatan uçların gövdesi: kullanıcı ön bilgilendirmeyi ve sözleşmeyi onaylamış olmalı. */
export const payBody = z.object({ accept: z.boolean().optional() }).passthrough();

export function assertAccepted(accept: unknown) {
  if (accept !== true) throw new AppError('PREINFO_REQUIRED', 'errors.preinfo_required', 400);
}
