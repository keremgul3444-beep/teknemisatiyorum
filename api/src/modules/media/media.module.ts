import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalDiskStorage, STORAGE } from '../../adapters/storage';

@Module({
  controllers: [MediaController],
  providers: [MediaService, { provide: STORAGE, useClass: LocalDiskStorage }],
  exports: [MediaService],
})
export class MediaModule {}
