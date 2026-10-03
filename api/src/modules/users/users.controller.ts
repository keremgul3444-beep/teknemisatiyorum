import { Body, Controller, Delete, Get, Header, HttpCode, Patch } from '@nestjs/common';
import { retireServices } from '../marketplace/lifecycle';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { prefsOf, userView } from './user.view';
import { MediaService } from '../media/media.service';
import { Errors } from '../../common/errors';

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
    // Satır kilidiyle oku-birleştir-yaz: art arda gelen değişiklikler birbirini ezmez; izin kaydı aynı işlemde.
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id} FOR UPDATE`;
      const before = prefsOf(await tx.user.findUniqueOrThrow({ where: { id: u.id } }));
      const next = prefs ? { ...before, ...prefs } : undefined;
      if (next) {
        // Pazarlama bildirimi yalnızca açık rıza ile açılabilir; rıza geri alınınca kendiliğinden kapanır.
        if (prefs!.notifyMarketing && !next.marketingConsent) throw Errors.bad('CONSENT_REQUIRED');
        if (!next.marketingConsent) next.notifyMarketing = false;
      }
      const saved = await tx.user.update({ where: { id: u.id }, data: { ...rest, ...(next ? { prefs: next } : {}) } });
      if (next && next.marketingConsent !== before.marketingConsent) {
        await this.audit.log(u.id, 'audit.marketingConsent', { value: String(next.marketingConsent) }, 'user', u.id, tx);
      }
      return saved;
    });
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
    const [user, sessions, listings, boats, favorites, savedSearches, convs, expertiseBookings, brokerCases, notifications, verificationRequests, consentHistory, reports] = await Promise.all([
      p.user.findUniqueOrThrow({ where: { id } }),
      p.session.findMany({ where: { userId: id }, select: { deviceName: true, createdAt: true, lastSeenAt: true, revokedAt: true } }),
      p.listing.findMany({ where: { ownerId: id } }),
      p.boat.findMany({ where: { ownerId: id }, include: { entries: true } }),
      p.favorite.findMany({ where: { userId: id }, select: { listingId: true, createdAt: true } }),
      p.savedSearch.findMany({ where: { userId: id } }),
      p.conversation.findMany({
        where: { members: { some: { userId: id } } },
        select: { id: true, subjectKind: true, subjectTitle: true, createdAt: true, messages: { select: { text: true, createdAt: true, senderId: true }, orderBy: { createdAt: 'asc' } } },
      }),
      p.expertiseBooking.findMany({ where: { userId: id } }),
      p.brokerCase.findMany({ where: { userId: id } }),
      p.notification.findMany({ where: { userId: id } }),
      p.verificationRequest.findMany({ where: { userId: id }, select: { kind: true, status: true, rejectReason: true, createdAt: true, decidedAt: true, details: true } }),
      p.auditLog.findMany({ where: { actorId: id, action: { in: ['audit.marketingConsent', 'audit.preinfoAccepted'] } }, select: { action: true, params: true, at: true }, orderBy: { at: 'asc' } }),
      p.listingReport.findMany({ where: { reporterId: id }, select: { listingId: true, reason: true, note: true, status: true, createdAt: true } }),
    ]);
    // Öne çıkarma siparişleri, firma üyelikleri ve 2. dalga (usta/kaptan profilleri, işler, teklifler, rezervasyonlar, ödemeler, değerlendirmeler).
    const [orders, companies, providers, jobs, captainBookings, servicePayments, reviewsWritten] = await Promise.all([
      p.order.findMany({ where: { userId: id }, select: { id: true, listingId: true, productCode: true, channel: true, amountKurus: true, status: true, createdAt: true, paidAt: true, refundedAt: true } }),
      p.companyMember.findMany({ where: { userId: id }, select: { role: true, company: { select: { name: true, kind: true, city: true } } } }),
      p.providerProfile.findMany({ where: { userId: id }, include: { quotes: { select: { jobId: true, priceTry: true, days: true, note: true, createdAt: true } } } }),
      p.job.findMany({ where: { ownerId: id }, include: { quotes: { select: { priceTry: true, days: true, note: true, createdAt: true } } } }),
      p.captainBooking.findMany({ where: { userId: id }, select: { id: true, start: true, days: true, totalEur: true, status: true, createdAt: true } }),
      p.servicePayment.findMany({ where: { payerId: id }, select: { subjectKind: true, subjectId: true, amountKurus: true, feeKurus: true, status: true, createdAt: true, paidAt: true, releasedAt: true, refundedAt: true } }),
      p.review.findMany({ where: { authorId: id }, select: { subjectKind: true, stars: true, text: true, createdAt: true } }),
    ]);
    await this.audit.log(id, 'audit.dataExported', {}, 'user', id);
    return {
      exportedAt: new Date(), profile: userView(user),
      sessions, listings, boats, favorites, savedSearches, expertiseBookings, brokerCases, notifications, verificationRequests, consentHistory,
      // Kişinin gönderdiği ilan bildirimleri ve varsa hesabının askıya alınma kaydı.
      reports, suspension: user.suspendedAt ? { at: user.suspendedAt, reason: user.suspendReason } : null,
      orders, companies, providers, jobs, captainBookings, servicePayments, reviewsWritten,
      // Sohbetler: kişinin gönderdiği ve aldığı mesajlar (karşı tarafın numarası yok).
      conversations: convs.map(({ messages, ...c }) => ({ ...c, messages: messages.map(({ senderId, ...m }) => ({ ...m, mine: senderId === id })) })),
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
    const { phone } = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { phone: true } });
    await this.prisma.$transaction([
      // Giriş kodu kayıtları da telefon numarası taşır; hesapla birlikte gider.
      ...(phone ? [this.prisma.otpCode.deleteMany({ where: { phone } })] : []),
      this.prisma.user.update({
        where: { id: u.id },
        data: { phone: null, name: null, email: null, nationalIdEnc: null, nationalIdLast2: null, nationalIdHash: null, deletedAt: now },
      }),
      // KVKK: silinen kişinin ilanları yayından kalkar (kayıt geçmiş için saklanır, kimseye gösterilmez).
      this.prisma.listing.updateMany({ where: { ownerId: u.id, status: { not: 'removed' } }, data: { status: 'removed' } }),
      this.prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    // Usta/kaptan profili listeden kalkar ve görünen bilgileri silinir; açık iş talepleri iptal olur.
    await retireServices(this.prisma, u.id, { anonymize: true });
    // Firma üyelikleri biter (sahibi olduğu firma diğer üyeler için kalır).
    await this.prisma.companyMember.deleteMany({ where: { userId: u.id } });
    await this.media.purgeUser(u.id);
    await this.audit.log(u.id, 'audit.accountDeleted', {}, 'user', u.id);
  }
}
