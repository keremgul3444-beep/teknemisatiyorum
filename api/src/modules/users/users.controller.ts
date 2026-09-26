import { Body, Controller, Delete, Get, Header, HttpCode, Patch } from '@nestjs/common';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { prefsOf, userView } from './user.view';
import { MediaService } from '../media/media.service';

const patchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.email().max(120).optional(),
  lang: z.enum(['tr', 'en']).optional(),
  prefs: z.strictObject({
    notifyMessages: z.boolean(), notifyMatches: z.boolean(), notifyMarketing: z.boolean(),
    phoneVisible: z.boolean(), marketingConsent: z.boolean(),
  }).partial().optional(),
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
    const { prefs, ...rest } = b;
    const cur = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    const before = prefsOf(cur);
    const next = prefs ? { ...before, ...prefs } : undefined;
    const user = await this.prisma.user.update({ where: { id: u.id }, data: { ...rest, ...(next ? { prefs: next } : {}) } });
    // Pazarlama izni (açık rıza) verildiğinde ya da geri alındığında iz kalır.
    if (next && next.marketingConsent !== before.marketingConsent) {
      await this.audit.log(u.id, 'audit.marketingConsent', { value: String(next.marketingConsent) }, 'user', u.id);
    }
    return userView(user);
  }

  /**
   * KVKK md. 11 — kişinin kendi verisinin kopyası (JSON dosyası). Şifreli kimlik, özetler ve oturum
   * anahtarları gibi güvenlik alanları bilerek dışarıda; yalnızca açıkça seçilen alanlar çıkar.
   */
  @Auth()
  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="verilerim.json"')
  async export(@CurrentUser() u: AuthUser) {
    const id = u.id;
    const p = this.prisma;
    const [user, sessions, listings, boats, favorites, savedSearches, messages, expertiseBookings, brokerCases, notifications, verificationRequests] = await Promise.all([
      p.user.findUniqueOrThrow({ where: { id } }),
      p.session.findMany({ where: { userId: id }, select: { deviceName: true, createdAt: true, lastSeenAt: true, revokedAt: true } }),
      p.listing.findMany({ where: { ownerId: id } }),
      p.boat.findMany({ where: { ownerId: id }, include: { entries: true } }),
      p.favorite.findMany({ where: { userId: id }, select: { listingId: true, createdAt: true } }),
      p.savedSearch.findMany({ where: { userId: id } }),
      p.message.findMany({ where: { senderId: id }, select: { conversationId: true, text: true, createdAt: true } }),
      p.expertiseBooking.findMany({ where: { userId: id } }),
      p.brokerCase.findMany({ where: { userId: id } }),
      p.notification.findMany({ where: { userId: id } }),
      p.verificationRequest.findMany({ where: { userId: id }, select: { kind: true, status: true, rejectReason: true, createdAt: true, decidedAt: true, details: true } }),
    ]);
    await this.audit.log(id, 'audit.dataExported', {}, 'user', id);
    return {
      exportedAt: new Date(), profile: userView(user),
      sessions, listings, boats, favorites, savedSearches, messages, expertiseBookings, brokerCases, notifications, verificationRequests,
    };
  }

  /**
   * Hesap silme: kişisel alanlar temizlenir ve kullanıcı anonimleşir; ilanları yayından kalkar,
   * karne geçmişi "silinmiş kullanıcı" olarak kalır. Tüm oturumlar kapanır.
   */
  @Auth()
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: u.id },
        data: { phone: null, name: null, email: null, nationalIdEnc: null, nationalIdLast2: null, nationalIdHash: null, deletedAt: now },
      }),
      // KVKK: silinen kişinin ilanları yayından kalkar (kayıt geçmiş için saklanır, kimseye gösterilmez).
      this.prisma.listing.updateMany({ where: { ownerId: u.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
      this.prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    await this.media.purgePrivate(u.id);
    await this.audit.log(u.id, 'audit.accountDeleted', {}, 'user', u.id);
  }
}
