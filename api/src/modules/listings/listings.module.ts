import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ListingsController } from './listings.controller';
import { SavedSearchesController } from './saved-searches.controller';
import { ListingsService } from './listings.service';
import { FxController, FxService } from './fx.service';

@Module({
  imports: [MediaModule],
  controllers: [ListingsController, SavedSearchesController, FxController],
  providers: [ListingsService, FxService],
  exports: [ListingsService, FxService],
})
export class ListingsModule {}
