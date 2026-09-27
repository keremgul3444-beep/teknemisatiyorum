import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { Errors } from '../../common/errors';
import { MediaService } from './media.service';

const uploadBody = z.object({ visibility: z.enum(['public', 'private']) });

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Auth()
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body(new ZodPipe(uploadBody)) b: z.infer<typeof uploadBody>) {
    if (!file) throw Errors.bad('FILE_REQUIRED');
    return this.media.upload(u.id, file.buffer, b.visibility);
  }

  // Görsel okumaları genel istek sınırına sayılmaz (fotoğraflı sayfalar tek seferde çok istek yapar).
  @Public()
  @SkipThrottle()
  @Get(':id')
  async get(@Param('id') id: string, @Query('w') w: string | undefined, @Res() res: Response) {
    const f = w === undefined ? await this.media.readPublic(id) : await this.media.readPublicWidth(id, Number(w));
    res.type(f.mime).setHeader('Cache-Control', 'public, max-age=86400').send(f.data);
  }

  @Auth()
  @Get(':id/signed')
  signed(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.media.signedUrl(id, u.id, u.roles.includes('moderator') || u.roles.includes('admin'));
  }

  @Public()
  @SkipThrottle()
  @Get(':id/raw')
  async raw(@Param('id') id: string, @Query('exp') exp: string, @Query('sig') sig: string, @Res() res: Response) {
    const f = await this.media.readSigned(id, exp, sig);
    res.type(f.mime).setHeader('Cache-Control', 'private, no-store').send(f.data);
  }
}
