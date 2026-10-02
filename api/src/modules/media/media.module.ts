import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaJanitor, MediaService } from './media.service';
import { LocalDiskStorage, STORAGE } from '../../adapters/storage';

@Module({
  controllers: [MediaController],
  providers: [MediaService, MediaJanitor, { provide: STORAGE, useClass: LocalDiskStorage }],
  exports: [MediaService],
})
export class MediaModule {}
