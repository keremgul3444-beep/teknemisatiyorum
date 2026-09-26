import { Body, Controller, Get, HttpCode, Module, Param, Post } from '@nestjs/common';
import type { SubjectKind } from '@prisma/client';
import { z } from 'zod';
import { Auth, CurrentUser, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../common/prisma.service';
import { Errors } from '../../common/errors';
import { NotificationsService } from '../notifications/notifications.module';

const startBody = z.object({ subjectKind: z.enum(['listing', 'broker', 'expertise']), subjectId: z.string().min(1) });
const messageBody = z.object({ text: z.string().trim().min(1).max(2000) });

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
    const existing = await this.prisma.conversation.findUnique({
      where: { subjectKind_subjectId_memberKey: { subjectKind: b.subjectKind, subjectId: b.subjectId, memberKey } },
    });
    const c = existing ?? await this.prisma.conversation.create({
      data: {
        subjectKind: b.subjectKind, subjectId: b.subjectId, subjectTitle: title, memberKey,
        members: { create: [{ userId: u.id, lastReadAt: new Date() }, { userId: otherId }] },
      },
    });
    return { id: c.id };
  }

  @Auth()
  @Get()
  async list(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { members: { some: { userId: u.id } } },
      include: { members: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
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
    const otherUser = await this.prisma.user.findUnique({ where: { id: other.userId }, select: { name: true, phone: true } });
    const msgs = await this.prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'asc' }, take: 500 });
    return {
      id: c.id,
      subject: { kind: c.subjectKind, id: c.subjectId, title: c.subjectTitle },
      otherName: otherUser?.name ?? null,
      /** Karşı taraf numarasını paylaştıysa görünür; paylaşım tek yönlüdür. */
      otherPhone: other.phoneShared ? otherUser?.phone ?? null : null,
      iSharedPhone: c.members.find((m) => m.userId === u.id)!.phoneShared,
      messages: msgs.map((m) => ({ id: m.id, text: m.text, at: m.createdAt, mine: m.senderId === u.id })),
    };
  }

  @Auth()
  @Post(':id/messages')
  async send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new ZodPipe(messageBody)) b: z.infer<typeof messageBody>) {
    const c = await this.memberOf(id, u.id);
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId: id, senderId: u.id, text: b.text } }),
      this.prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
      this.prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { lastReadAt: new Date() } }),
    ]);
    const other = c.members.find((x) => x.userId !== u.id)!;
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
