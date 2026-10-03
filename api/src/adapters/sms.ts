import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';

export const SMS_SENDER = Symbol('SMS_SENDER');

/** SMS takma yuvası. Gerçek sağlayıcı bağlanınca yalnızca bu arayüzün yeni bir uygulaması yazılır. */
export interface SmsSender {
  sendOtp(phone: string, code: string): Promise<void>;
}

/**
 * Geliştirme uygulaması: SMS göndermez; kodu sunucu kaydına ve yönetim panelindeki
 * "gelen kodlar" kutusuna (son 50) yazar. Üretimde kullanılmaz.
 */
@Injectable()
export class DevSmsSender implements SmsSender {
  private readonly log = new Logger('DevSms');
  private readonly box: { phone: string; code: string; at: Date }[] = [];

  async sendOtp(phone: string, code: string) {
    this.box.push({ phone, code, at: new Date() });
    if (this.box.length > 50) this.box.shift();
    this.log.log(`${phone} için giriş kodu: ${code}`);
  }

  inbox() {
    return [...this.box];
  }
}

/** Giriş kodu metni (kısa; Türkçe karakterli — sağlayıcıya Türkçe kodlama bildirilir). */
export const otpText = (code: string) => `teknemisatıyorum giriş kodun: ${code}. Kodu kimseyle paylaşma.`;
const local10 = (phone: string) => phone.replace(/^\+90/, '');

/**
 * Netgsm (Türkiye): klasik HTTP gönderim ucu. Başarıda yanıt "00 <iş no>" (ya da 01/02), hatada iki haneli hata kodu.
 * Gönderici adı (msgheader) Netgsm panelinde onaylı başlık olmalı. Canlıya almadan önce sağlayıcının güncel belgesiyle
 * ve tek bir gerçek numarayla doğrulanmalı.
 */
export class NetgsmSmsSender implements SmsSender {
  constructor(private readonly c = env(), private readonly fetchImpl: typeof fetch = fetch) {}
  async sendOtp(phone: string, code: string) {
    const q = new URLSearchParams({
      usercode: this.c.SMS_USER, password: this.c.SMS_PASSWORD, gsmno: local10(phone), message: otpText(code), msgheader: this.c.SMS_SENDER_NAME, dil: 'TR',
    });
    const r = await this.fetchImpl(`https://api.netgsm.com.tr/sms/send/get?${q}`, { signal: AbortSignal.timeout(10_000) });
    const body = (await r.text()).trim();
    if (!r.ok || !/^0[0-2]\b/.test(body)) throw new Error(`Netgsm gönderemedi: ${body.slice(0, 40)}`);
  }
}

/** Twilio Messages API (yedek sağlayıcı). Türkiye'ye gönderim için gönderici kaydı Twilio panelinde yapılmalı. */
export class TwilioSmsSender implements SmsSender {
  constructor(private readonly c = env(), private readonly fetchImpl: typeof fetch = fetch) {}
  async sendOtp(phone: string, code: string) {
    const body = new URLSearchParams({ To: phone, From: this.c.SMS_SENDER_NAME, Body: otpText(code) });
    const auth = Buffer.from(`${this.c.SMS_USER}:${this.c.SMS_PASSWORD}`).toString('base64');
    const r = await this.fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.c.SMS_USER)}/Messages.json`, {
      method: 'POST', body, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`Twilio gönderemedi: ${r.status}`);
  }
}

/**
 * Ortama göre SMS: dev = gönderilmez (geliştirme gelen kutusu), netgsm / twilio = gerçek.
 * Üretimde dev ile açılmaz: aksi halde giriş kodları kimseye ulaşmaz ve kimse giriş yapamaz.
 */
export function smsSenderFor(dev: DevSmsSender): SmsSender {
  const e = env();
  if (e.SMS_MODE === 'netgsm') return new NetgsmSmsSender(e);
  if (e.SMS_MODE === 'twilio') return new TwilioSmsSender(e);
  if (e.NODE_ENV === 'production') throw new Error('SMS_MODE=dev üretimde kullanılamaz: giriş kodları gönderilmez. SMS_MODE=netgsm ya da twilio ayarla.');
  return dev;
}
