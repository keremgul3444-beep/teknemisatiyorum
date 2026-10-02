import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import type { SubjectKind } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { NotificationsService } from '../notifications/notifications.module';
import { prefsOf } from '../users/user.view';

const startBody = z.object({ subjectKind: z.enum(['listing', 'broker', 'expertise']), subjectId: z.string().min(1) });
const messageBody = z.object({ text: z.string().trim().min(1).max(2000) });

/** Spam ve numara toplamaya karşı sınırlar. */
export const MESSAGE_LIMITS = {
  /** Kişi başına günde açılabilecek yeni sohbet. */
  newConversationsPerDay: 20,
  /** Kişi başına saatte gönderilebilecek mesaj (tüm sohbetler). */
  messagesPerHour: 60,
  /** Karşı taraf hiç yanıt vermediyse bir sohbette en fazla bu kadar mesaj. */
  unansweredInRow: 5,
} as const;
const HOUR_MS = 36e5;

@Controller('conversations')
class MessagesController {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  /**
   * Konu üzerinden sohbet açar. İlan için karşı taraf ilan sahibidir; broker ve ekspertiz konularında
   * platform ekibi (ilk yönetici hesabı). Aynı konu + aynı taraflar için tek sohbet vardır.
   */
  @Auth()
  @Post()
  async start(@CurrentUser() u: AuthUser, @Body(new ZodPipe(startBody)) b: z.infer<typeof startBody>) {
    const { otherId, title } = await this.counterpart(u.id, b.subjectKind, b.subjectId);
    const memberKey = [u.id, otherId].sort().join(':');
    const where = { subjectKind_subjectId_memberKey: { subjectKind: b.subjectKind, subjectId: b.subjectId, memberKey } };
    const existing = await this.prisma.conversation.findUnique({ where });
    if (existing) return { id: existing.id };
    const started = await this.prisma.conversation.count({ where: { startedById: u.id, createdAt: { gt: new Date(Date.now() - 24 * HOUR_MS) } } });
    if (started >= MESSAGE_LIMITS.newConversationsPerDay) throw Errors.tooMany('CONVERSATION_LIMIT');
    try {
      const c = await this.prisma.conversation.create({
        data: {
          subjectKind: b.subjectKind, subjectId: b.subjectId, subjectTitle: title, memberKey, startedById: u.id,
          members: { create: [{ userId: u.id, lastReadAt: new Date() }, { userId: otherId }] },
        },
      });
      return { id: c.id };
    } catch (e) {
      // Aynı anda iki istek: ikincisi tekillik ihlaline düşer; oluşan sohbet döndürülür.
      if ((e as { code?: string }).code !== 'P2002') throw e;
      return { id: (await this.prisma.conversation.findUniqueOrThrow({ where })).id };
    }
  }

  @Auth()
  @Get()
  async list(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { members: { some: { userId: u.id } } },
      include: { members: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const otherIds = rows.map((c) => c.members.find((m) => m.userId !== u.id)!.userId);
    const others = await this.prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true } });
    return rows.map((c) => {
      const me = c.members.find((m) => m.userId === u.id)!;
      const other = c.members.find((m) => m.userId !== u.id)!;
      const last = c.messages[0];
      return {
        id: c.id,
        subject: { kind: c.subjectKind, id: c.subjectId, title: c.subjectTitle },
        otherName: others.find((o) => o.id === other.userId)?.name ?? null,
        lastMessage: last ? { text: last.text, at: last.createdAt, mine: last.senderId === u.id } : null,
        unread: !!last && last.senderId !== u.id && (!me.lastReadAt || last.createdAt > me.lastReadAt),
      };
    });
  }

  @Auth()
  @Get(':id/messages')
  async messages(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const c = await this.memberOf(id, u.id);
    const other = c.members.find((m) => m.userId !== u.id)!;
    const otherUser = await this.prisma.user.findUnique({ where: { id: other.userId }, select: { name: true, phone: true, prefs: true } });
    // En yeni 500 mesaj (eskiden yeniye sıralı döner).
    const msgs = (await this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'desc' }, take: 500 })).reverse();
    const me = c.members.find((m) => m.userId === u.id)!;
    // "Telefonum görünsün" numarayı yalnızca sohbete gerçekten yazmış kişiye açar: boş sohbet açarak numara toplanamaz.
    const iWrote = msgs.some((m) => m.senderId === u.id) || (await this.prisma.message.count({ where: { conversationId: id, senderId: u.id } })) > 0;
    return {
      id: c.id,
      subject: { kind: c.subjectKind, id: c.subjectId, title: c.subjectTitle },
      otherName: otherUser?.name ?? null,
      /** Karşı taraf numarasını bu sohbette paylaştıysa ya da ayarlardan herkese görünür yaptıysa. */
      otherPhone: otherUser && (other.phoneShared || (prefsOf(otherUser).phoneVisible && iWrote)) ? otherUser.phone : null,
      iSharedPhone: me.phoneShared,
      /** Engel: `me` bu kişi engelledi (kaldırabilir), `them` karşı taraf engelledi; ikisinde de mesaj yazılamaz. */
      blocked: me.blockedAt ? 'me' : other.blockedAt ? 'them' : null,
      messages: msgs.map((m) => ({ id: m.id, text: m.text, at: m.createdAt, mine: m.senderId === u.id })),
    };
  }

  @Auth()
  @Post(':id/messages')
  async send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(messageBody)) b: z.infer<typeof messageBody>) {
    const c = await this.memberOf(id, u.id);
    const other = c.members.find((x) => x.userId !== u.id)!;
    const gone = await this.prisma.user.count({ where: { id: other.userId, deletedAt: { not: null } } });
    if (gone) throw new AppError('USER_DELETED', 'errors.user_deleted', 409);
    if (other.blockedAt || c.members.some((m) => m.userId === u.id && m.blockedAt)) throw new AppError('BLOCKED', 'errors.blocked', 403);
    const [lastHour, answered, mine] = await Promise.all([
      this.prisma.message.count({ where: { senderId: u.id, createdAt: { gt: new Date(Date.now() - HOUR_MS) } } }),
      this.prisma.message.count({ where: { conversationId: id, senderId: other.userId } }),
      this.prisma.message.count({ where: { conversationId: id, senderId: u.id } }),
    ]);
    if (lastHour >= MESSAGE_LIMITS.messagesPerHour) throw Errors.tooMany('MESSAGE_LIMIT');
    if (!answered && mine >= MESSAGE_LIMITS.unansweredInRow) throw Errors.tooMany('AWAITING_REPLY');
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId: id, senderId: u.id, text: b.text } }),
      this.prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
      this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { lastReadAt: new Date() } }),
    ]);
    await this.notifications.push(other.userId, 'notif.newMessage', { conversationId: id, title: c.subjectTitle });
    return { id: m.id, text: m.text, at: m.createdAt, mine: true };
  }

  @Auth()
  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.memberOf(id, u.id);
    await this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { lastReadAt: new Date() } });
  }

  @Auth()
  @Post(':id/share-phone')
  @HttpCode(204)
  async sharePhone(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.memberOf(id, u.id);
    await this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { phoneShared: true } });
  }

  /** Karşı tarafı engelle: bu sohbete iki taraf da yazamaz; karşı tarafın numarası (paylaşılmışsa) kalır, yeni bildirim gitmez. */
  @Auth()
  @Post(':id/block')
  @HttpCode(204)
  async block(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.memberOf(id, u.id);
    await this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { blockedAt: new Date() } });
  }

  @Auth()
  @Post(':id/unblock')
  @HttpCode(204)
  async unblock(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.memberOf(id, u.id);
    await this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { blockedAt: null } });
  }

  private async memberOf(id: string, userId: string) {
    const c = await this.prisma.conversation.findFirst({ where: { id, members: { some: { userId } } }, include: { members: true } });
    if (!c) throw Errors.notFound();
    return c;
  }

  private async counterpart(userId: string, kind: SubjectKind, subjectId: string) {
    if (kind === 'listing') {
      const l = await this.prisma.listing.findUnique({ where: { id: subjectId } });
      if (!l || !['published', 'sold'].includes(l.status)) throw Errors.notFound();
      if (l.ownerId === userId) throw Errors.bad('OWN_LISTING');
      return { otherId: l.ownerId, title: `${l.brand} ${l.model} · ${l.year}` };
    }
    const own = kind === 'broker'
      ? await this.prisma.brokerCase.findFirst({ where: { id: subjectId, userId } })
      : await this.prisma.expertiseBooking.findFirst({ where: { id: subjectId, userId } });
    if (!own) throw Errors.notFound();
    const staff = await this.prisma.user.findFirst({ where: { roles: { has: 'admin' }, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!staff || staff.id === userId) throw Errors.bad('NO_STAFF');
    return { otherId: staff.id, title: kind === 'broker' ? `broker:${subjectId}` : `expertise:${subjectId}` };
  }
}

@Module({ controllers: [MessagesController] })
export class MessagesModule {}
