import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ListingsController } from './listings.controller';
import { SavedSearchesController } from './saved-searches.controller';
import { ListingsService } from './listings.service';
import { FxController, FxService } from './fx.service';
import { ListingExpiry } from './expiry';

@Module({
  imports: [MediaModule],
  controllers: [ListingsController, SavedSearchesController, FxController],
  providers: [ListingsService, FxService, ListingExpiry],
  exports: [ListingsService, FxService, ListingExpiry],
})
export class ListingsModule {}
