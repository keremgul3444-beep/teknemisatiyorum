import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaJanitor, MediaService } from './media.service';
import { STORAGE, storageProvider } from '../../adapters/storage';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaJanitor, storageProvider],
  exports: [MediaService, STORAGE],
})
export class MediaModule {}
