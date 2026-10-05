import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { VerificationController } from '../verification/verification.controller';
import { CompaniesController } from '../companies/companies.controller';
import { MediaModule } from '../media/media.module';
import { ListingsModule } from '../listings/listings.module';
import { identityProvider } from '../../adapters/identity';
import { IMAGE_FETCHER, fetchPublicImage } from '../../adapters/image-fetch';
import { ImportController } from '../companies/import/import.controller';
import { ImportRunner } from '../companies/import/import.service';

/** Kullanıcı, kimlik/belge doğrulama ve kurumsal hesap uç noktaları. */
@Module({
  imports: [MediaModule, ListingsModule],
  controllers: [UsersController, VerificationController, CompaniesController, ImportController],
  providers: [identityProvider, ImportRunner, { provide: IMAGE_FETCHER, useValue: fetchPublicImage }],
})
export class UsersModule {}
