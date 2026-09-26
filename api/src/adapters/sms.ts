import { Injectable, Logger } from '@nestjs/common';

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
