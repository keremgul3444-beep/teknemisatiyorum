import crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma.service';
import { AppError, Errors } from '../../common/errors';
import { CLOCK, type Clock } from '../../common/clock';
import { SMS_SENDER, type SmsSender } from '../../adapters/sms';
import { userView } from '../users/user.view';
import { decrypt, encrypt } from '../../common/crypto';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_MS = 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
/** Aynı anda gelen yenilemeler (sekmeler, ön yükleme) için: döndürülen anahtar bu süre boyunca aynı halefi alır. */
const REFRESH_GRACE_MS = 10_000;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const otpError = (code: string) => new AppError(code, `errors.${code.toLowerCase()}`, 401);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async requestOtp(phone: string) {
    const now = this.clock.now();
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, createdAt: { gt: new Date(now.getTime() - OTP_RESEND_MS) } },
    });
    if (recent) throw Errors.tooMany('OTP_RATE');
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.otpCode.create({
      data: { phone, codeHash: await argon2.hash(code), expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now },
    });
    await this.sms.sendOtp(phone, code);
    const user = await this.prisma.user.findUnique({ where: { phone }, select: { roles: true } });
    const staff = !!user?.roles.some((r) => r === 'admin' || r === 'moderator');
    return { code, staff };
  }

  async verifyOtp(phone: string, code: string, deviceName: string) {
    const now = this.clock.now();
    const otp = await this.prisma.otpCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp) throw otpError('OTP_INVALID');
    if (otp.expiresAt <= now) throw otpError('OTP_EXPIRED');
    // Deneme hakkı doğrulamadan ÖNCE atomik olarak düşülür: eşzamanlı tahminler 5 sınırını aşamaz.
    const slot = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (slot.count !== 1) throw otpError('OTP_LOCKED');
    if (!(await argon2.verify(otp.codeHash, code))) throw otpError('OTP_INVALID');
    // Atomik tüketim: aynı kodla eşzamanlı iki istekten yalnızca biri geçer.
    const consumed = await this.prisma.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: now } });
    if (consumed.count !== 1) throw otpError('OTP_INVALID');

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing?.suspendedAt) throw new AppError('ACCOUNT_SUSPENDED', 'errors.account_suspended', 403);
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { verifyLevel: Math.max(1, existing.verifyLevel) } })
      : await this.prisma.user.create({ data: { phone, verifyLevel: 1 } });
    const familyId = crypto.randomUUID();
    return { ...(await this.issue(user.id, familyId, deviceName.slice(0, 60) || 'Cihaz', now)), user: userView(user) };
  }

  async refresh(refreshToken: string) {
    const now = this.clock.now();
    const s = await this.prisma.session.findUnique({ where: { refreshHash: sha256(refreshToken) } });
    if (!s) throw otpError('REFRESH_INVALID');
    // Süresi geçmiş tolerans kayıtları (şifreli halef anahtarı) veritabanında bekletilmez.
    await this.prisma.session.updateMany({ where: { familyId: s.familyId, graceUntil: { lte: now } }, data: { graceRefreshEnc: null, graceUntil: null } });
    if (s.revokedAt) {
      // Az önce döndürülmüş anahtar (aynı anda gelen iki istek, sekmeler, ön yükleme): aynı halef verilir.
      const grace = await this.graceReturn(s.id, now);
      if (grace) return grace;
      // Daha önce döndürülmüş bir anahtar pencere dışında yeniden geldi: çalınma şüphesi, tüm aile kapatılır.
      if (s.replacedById) {
        await this.prisma.session.updateMany({ where: { familyId: s.familyId, revokedAt: null }, data: { revokedAt: now } });
        throw otpError('REFRESH_REUSED');
      }
      throw otpError('REFRESH_INVALID');
    }
    if (now.getTime() - s.lastSeenAt.getTime() > REFRESH_TTL_MS) throw otpError('REFRESH_EXPIRED');
    const user = await this.prisma.user.findUnique({ where: { id: s.userId } });
    if (!user || user.deletedAt || user.suspendedAt) throw otpError('REFRESH_INVALID');
    const next = await this.issue(user.id, s.familyId, s.deviceName, now);
    // Yarış güvenliği: yalnızca hâlâ açık olan satır döndürülür.
    const rotated = await this.prisma.session.updateMany({
      where: { id: s.id, revokedAt: null },
      data: {
        revokedAt: now, replacedById: next.sessionId,
        graceRefreshEnc: encrypt(next.refreshToken), graceUntil: new Date(now.getTime() + REFRESH_GRACE_MS),
      },
    });
    if (rotated.count !== 1) {
      // Yarışı başka istek kazandı: bizim açtığımız fazla oturum kapatılır, kazananın halefi verilir.
      await this.prisma.session.update({ where: { id: next.sessionId }, data: { revokedAt: now } });
      const grace = await this.graceReturn(s.id, now);
      if (grace) return grace;
      await this.prisma.session.updateMany({ where: { familyId: s.familyId, revokedAt: null }, data: { revokedAt: now } });
      throw otpError('REFRESH_REUSED');
    }
    return { accessToken: next.accessToken, refreshToken: next.refreshToken, user: userView(user) };
  }

  /** Tolerans penceresindeki döndürülmüş oturum için halefin anahtarları; pencere dışında ya da halef kapalıysa null. */
  private async graceReturn(sessionId: string, now: Date) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!s?.replacedById || !s.graceRefreshEnc || !s.graceUntil || s.graceUntil.getTime() <= now.getTime()) return null;
    const successor = await this.prisma.session.findUnique({ where: { id: s.replacedById } });
    if (!successor || successor.revokedAt) return null;
    const user = await this.prisma.user.findUnique({ where: { id: s.userId } });
    if (!user || user.deletedAt || user.suspendedAt) return null;
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid: successor.id });
    return { accessToken, refreshToken: decrypt(s.graceRefreshEnc), user: userView(user) };
  }

  async sessions(userId: string, currentSessionId: string | null) {
    const rows = await this.prisma.session.findMany({ where: { userId, revokedAt: null }, orderBy: { lastSeenAt: 'desc' } });
    const current = currentSessionId ? await this.prisma.session.findUnique({ where: { id: currentSessionId } }) : null;
    return rows.map((r) => ({ id: r.id, deviceName: r.deviceName, lastSeenAt: r.lastSeenAt, current: r.familyId === current?.familyId }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const s = await this.prisma.session.findFirst({ where: { id: sessionId, userId } });
    if (!s) throw Errors.notFound();
    await this.prisma.session.updateMany({ where: { familyId: s.familyId, revokedAt: null }, data: { revokedAt: this.clock.now() } });
  }

  async logout(sessionId: string | null) {
    if (!sessionId) return;
    const s = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (s) await this.prisma.session.updateMany({ where: { familyId: s.familyId, revokedAt: null }, data: { revokedAt: this.clock.now() } });
  }

  private async issue(userId: string, familyId: string, deviceName: string, now: Date) {
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    const s = await this.prisma.session.create({
      data: { userId, familyId, deviceName, refreshHash: sha256(refreshToken), createdAt: now, lastSeenAt: now },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: s.id });
    return { accessToken, refreshToken, sessionId: s.id };
  }
}
