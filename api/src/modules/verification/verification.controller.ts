import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { AppError, Errors } from '../../common/errors';
import { blindIndex, encrypt } from '../../common/crypto';
import { IDENTITY_VERIFIER, type IdentityVerifier } from '../../adapters/identity';
import { MediaService } from '../media/media.service';
import { userView } from '../users/user.view';

const person = { firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), birthYear: z.number().int().min(1900).max(2010) };
const identityBody = z.union([
  z.object({ tckn: z.string().regex(/^\d{11}$/), ...person }),
  z.object({ passport: z.string().trim().min(5).max(20), nationality: z.string().trim().min(2).max(40), fileId: z.string().min(1), ...person }),
]);
const requestBody = z.object({
  kind: z.enum(['usta', 'kaptan', 'eksper', 'firma', 'ruhsat']),
  fileIds: z.array(z.string().min(1)).min(1).max(5),
  listingId: z.string().optional(),
});

const tcknInUse = () => new AppError('TCKN_IN_USE', 'errors.tckn_in_use', 409);

@Controller('verification')
export class VerificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    @Inject(IDENTITY_VERIFIER) private readonly identity: IdentityVerifier,
  ) {}

  /**
   * T.C. vatandaşı: numara doğrulanırsa seviye 2 ve numara şifreli saklanır (yalnızca son 2 hane okunur).
   * Yabancı: pasaport görüntüsüyle incelemeye düşer; seviye moderatör onayıyla yükselir.
   */
  @Auth({ level: 1 })
  @Post('identity')
  @HttpCode(200)
  async verifyIdentity(@CurrentUser() u: AuthUser, @Body(new ZodPipe(identityBody)) b: z.infer<typeof identityBody>) {
    if ('tckn' in b) {
      if (!(await this.identity.verify(b))) throw Errors.bad('INVALID_TCKN');
      // Bir kimlik numarası tek hesaba bağlanır (sahte çoklu hesap önlemi); eşzamanlı denemeyi tekil dizin yakalar.
      const hash = blindIndex(b.tckn);
      const taken = await this.prisma.user.findFirst({ where: { nationalIdHash: hash, id: { not: u.id } }, select: { id: true } });
      if (taken) throw tcknInUse();
      const user = await this.prisma.user.update({
        where: { id: u.id },
        data: {
          verifyLevel: Math.max(2, u.level), name: `${b.firstName} ${b.lastName}`,
          nationalIdEnc: encrypt(b.tckn), nationalIdLast2: b.tckn.slice(-2), nationalIdHash: hash,
        },
      }).catch((e) => { throw e?.code === 'P2002' ? tcknInUse() : e; });
      await this.audit.log(u.id, 'audit.identityVerified', {}, 'user', u.id);
      return userView(user);
    }
    await this.media.assertOwnPrivate(u.id, [b.fileId]);
    await this.prisma.verificationRequest.create({
      data: {
        userId: u.id, kind: 'identity', fileIds: [b.fileId],
        details: { passport: b.passport, nationality: b.nationality, firstName: b.firstName, lastName: b.lastName, birthYear: b.birthYear },
      },
    });
    return userView(await this.prisma.user.update({ where: { id: u.id }, data: { name: `${b.firstName} ${b.lastName}` } }));
  }

  @Auth({ level: 1 })
  @Post('requests')
  async request(@CurrentUser() u: AuthUser, @Body(new ZodPipe(requestBody)) b: z.infer<typeof requestBody>) {
    await this.media.assertOwnPrivate(u.id, b.fileIds);
    if (b.listingId) {
      const own = await this.prisma.listing.count({ where: { id: b.listingId, ownerId: u.id } });
      if (!own) throw Errors.notFound();
    }
    const r = await this.prisma.verificationRequest.create({ data: { userId: u.id, kind: b.kind, fileIds: b.fileIds, listingId: b.listingId } });
    return { id: r.id, kind: r.kind, status: r.status, createdAt: r.createdAt };
  }

  @Auth()
  @Get('requests/mine')
  async mine(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.verificationRequest.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ id: r.id, kind: r.kind, status: r.status, rejectReason: r.rejectReason, createdAt: r.createdAt }));
  }
}
