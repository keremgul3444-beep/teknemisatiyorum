import crypto from 'crypto';
import { AppError } from '../common/errors';
import { safeEqual } from '../common/crypto';
import { env } from '../config/env';

export const WEB_PAYMENT = Symbol('WEB_PAYMENT');
export const STORE_VERIFIER = Symbol('STORE_VERIFIER');

export type WebCallback = { providerRef: string; orderId: string; result: 'success' | 'failure'; amountKurus: number };

/** Sanal POS takma yuvası. Gerçek sağlayıcı (Aşama 2) kendi bildirimini bu biçime çevirir. */
export interface WebPaymentProvider {
  createCheckout(o: { orderId: string; amountKurus: number }): Promise<{ providerRef: string; checkoutUrl: string }>;
  /** İmza doğrulanmadan hiçbir şey döndürmez; bozuk/imzasız bildirimde hata atar. */
  verifyCallback(rawBody: string, signature: string | undefined): WebCallback;
}

/** Mağaza makbuzu takma yuvası (Apple/Google). */
export interface StoreVerifier {
  verify(platform: 'ios' | 'android', receipt: string): Promise<{ storeProductId: string; transactionId: string }>;
}

const badSignature = () => new AppError('BAD_SIGNATURE', 'errors.bad_signature', 400);
const badReceipt = () => new AppError('BAD_RECEIPT', 'errors.bad_receipt', 400);

export const signPayload = (raw: string) => crypto.createHmac('sha256', env().PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex');

/** Deneme sanal POS'u: para çekmez; site deneme sayfası sonucu seçer, sunucu imzalı bildirimi kendisi üretir. */
export class DevWebPayment implements WebPaymentProvider {
  async createCheckout(o: { orderId: string; amountKurus: number }) {
    return { providerRef: `dev_${crypto.randomUUID()}`, checkoutUrl: `${env().WEB_URL}/odeme/deneme?order=${encodeURIComponent(o.orderId)}` };
  }

  verifyCallback(rawBody: string, signature: string | undefined): WebCallback {
    if (!signature || !safeEqual(signPayload(rawBody), signature)) throw badSignature();
    let b: Partial<WebCallback>;
    try { b = JSON.parse(rawBody); } catch { throw badSignature(); }
    if (typeof b.providerRef !== 'string' || typeof b.orderId !== 'string' || (b.result !== 'success' && b.result !== 'failure') || !Number.isInteger(b.amountKurus)) throw badSignature();
    return { providerRef: b.providerRef, orderId: b.orderId, result: b.result, amountKurus: b.amountKurus! };
  }

  simulate(c: WebCallback) {
    const rawBody = JSON.stringify(c);
    return { rawBody, signature: signPayload(rawBody) };
  }
}

/** Deneme mağaza doğrulayıcısı: yalnızca `dev:<mağazaÜrünKimliği>:<rastgele>` makbuzları. */
export class DevStoreVerifier implements StoreVerifier {
  async verify(_platform: 'ios' | 'android', receipt: string) {
    const m = /^dev:([\w.]+):([\w-]{6,})$/.exec(receipt);
    if (!m) throw badReceipt();
    return { storeProductId: m[1], transactionId: receipt };
  }
}

/** Moda göre sağlayıcılar. Üretimde deneme modu ve bu turda live başlamayı reddeder. */
export function paymentProviders() {
  const e = env();
  if (e.PAYMENTS_MODE === 'dev') {
    if (e.NODE_ENV === 'production') throw new Error('PAYMENTS_MODE=dev üretimde kullanılamaz (deneme ödemesi para çekmez)');
    return { web: new DevWebPayment(), store: new DevStoreVerifier() };
  }
  throw new Error('PAYMENTS_MODE=live: gerçek ödeme sağlayıcısı henüz bağlanmadı (Aşama 2)');
}
