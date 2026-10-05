import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ListingsController } from './listings.controller';
import { SavedSearchesController } from './saved-searches.controller';
import { ListingsService } from './listings.service';
import { FxController, FxService } from './fx.service';
import { ListingExpiry } from './expiry';
import { ListingTexts } from './listing-writer.service';
import { ClaudeListingWriter, LISTING_WRITER } from '../../adapters/listing-writer';

@Module({
  imports: [MediaModule],
  controllers: [ListingsController, SavedSearchesController, FxController],
  providers: [ListingsService, FxService, ListingExpiry, ListingTexts, { provide: LISTING_WRITER, useClass: ClaudeListingWriter }],
  exports: [ListingsService, FxService, ListingExpiry, ListingTexts],
})
export class ListingsModule {}
