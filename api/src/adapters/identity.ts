import { Injectable } from '@nestjs/common';
import { isValidTckn } from '@tms/shared';

export const IDENTITY_VERIFIER = Symbol('IDENTITY_VERIFIER');

export interface IdentityInput { tckn: string; firstName: string; lastName: string; birthYear: number }

/** Kimlik doğrulama takma yuvası. NVİ bağlanınca yalnızca bu arayüzün yeni uygulaması yazılır. */
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
