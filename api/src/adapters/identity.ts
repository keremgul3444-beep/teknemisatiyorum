import { Injectable } from '@nestjs/common';
import { isValidTckn } from '@tms/shared';
import { env } from '../config/env';

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

export interface IdentityInput { tckn: string; firstName: string; lastName: string; birthYear: number }

/** Kimlik doğrulama takma yuvası: algoritma (geliştirme) ya da NVİ (canlı). */
export interface IdentityVerifier {
  verify(input: IdentityInput): Promise<boolean>;
}

/** Geliştirme uygulaması: yalnızca numaranın algoritmik geçerliliğini denetler (kişinin gerçekliğini değil). */
@Injectable()
export class AlgorithmicIdentityVerifier implements IdentityVerifier {
  async verify(input: IdentityInput) {
    return isValidTckn(input.tckn);
  }
}

const NVI_URL = 'https://tckimlik.nvi.gov.tr/Service/KPSPublic.asmx';
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/** NVİ servisine ulaşılamadı: "kimlik geçersiz" değil, "sonra yeniden dene". */
export class IdentityServiceDown extends Error {}

/**
 * Nüfus ve Vatandaşlık İşleri'nin herkese açık KPSPublic servisi: numara, ad, soyad ve doğum yılı birlikte eşleşiyor mu.
 * Önce algoritma denetlenir (bozuk numara servise gitmez). Ad ve soyad Türkçe büyük harfe çevrilir (i → İ).
 */
@Injectable()
export class NviIdentityVerifier implements IdentityVerifier {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async verify(input: IdentityInput) {
    if (!isValidTckn(input.tckn)) return false;
    const up = (s: string) => xml(s.trim().toLocaleUpperCase('tr-TR'));
    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <TCKimlikNoDogrula xmlns="http://tckimlik.nvi.gov.tr/WS">
      <TCKimlikNo>${input.tckn}</TCKimlikNo><Ad>${up(input.firstName)}</Ad><Soyad>${up(input.lastName)}</Soyad><DogumYili>${input.birthYear}</DogumYili>
    </TCKimlikNoDogrula>
  </soap:Body>
</soap:Envelope>`;
    const res = await this.fetchImpl(NVI_URL, {
      method: 'POST', body, signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"http://tckimlik.nvi.gov.tr/WS/TCKimlikNoDogrula"' },
    }).catch(() => null);
    if (!res?.ok) throw new IdentityServiceDown(`NVİ yanıt vermedi (${res?.status ?? 'ağ'})`);
    const m = /<TCKimlikNoDogrulaResult>(true|false)<\/TCKimlikNoDogrulaResult>/.exec(await res.text());
    if (!m) throw new IdentityServiceDown('NVİ yanıtı okunamadı');
    return m[1] === 'true';
  }
}

/** Ortama göre: `IDENTITY_MODE=nvi` gerçek NVİ sorgusu, değilse yalnızca algoritma (geliştirme ve test). */
export const identityProvider = {
  provide: IDENTITY_VERIFIER,
  useFactory: (): IdentityVerifier => (env().IDENTITY_MODE === 'nvi' ? new NviIdentityVerifier() : new AlgorithmicIdentityVerifier()),
};
