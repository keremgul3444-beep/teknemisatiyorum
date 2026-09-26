import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { VerificationController } from '../verification/verification.controller';
import { CompaniesController } from '../companies/companies.controller';
import { MediaModule } from '../media/media.module';
import { AlgorithmicIdentityVerifier, IDENTITY_VERIFIER } from '../../adapters/identity';

/** Kullanıcı, kimlik/belge doğrulama ve kurumsal hesap uç noktaları. */
@Module({
  imports: [MediaModule],
  controllers: [UsersController, VerificationController, CompaniesController],
  providers: [{ provide: IDENTITY_VERIFIER, useClass: AlgorithmicIdentityVerifier }],
})
export class UsersModule {}
