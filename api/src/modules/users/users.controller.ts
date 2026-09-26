import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { userView } from './user.view';
import { MediaService } from '../media/media.service';

const patchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.email().max(120).optional(),
  lang: z.enum(['tr', 'en']).optional(),
});

@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly media: MediaService) {}

  @Auth()
  @Get()
  async me(@CurrentUser() u: AuthUser) {
    return userView(await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } }));
  }

  @Auth()
  @Patch()
  async patch(@CurrentUser() u: AuthUser, @Body(new ZodPipe(patchBody)) b: z.infer<typeof patchBody>) {
    return userView(await this.prisma.user.update({ where: { id: u.id }, data: b }));
  }

  /**
   * Hesap silme: kişisel alanlar temizlenir ve kullanıcı anonimleşir; ilan ve karne geçmişi
   * "silinmiş kullanıcı" olarak kalır. Tüm oturumlar kapanır.
   */
  @Auth()
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: u.id },
        data: { phone: null, name: null, email: null, nationalIdEnc: null, nationalIdLast2: null, deletedAt: now },
      }),
      this.prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.media.purgePrivate(u.id);
    await this.audit.log(u.id, 'audit.accountDeleted', {}, 'user', u.id);
  }
}
