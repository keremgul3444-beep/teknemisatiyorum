import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { Errors } from './errors';
import { AUTH_KEY, PUBLIC_KEY, type AuthRule, type AuthUser } from './decorators';

/**
 * Varsayılanı kapalı yetki kapısı.
 * Seviye ve roller anahtardan değil her istekte veritabanından okunur: kimlik doğrulanınca
 * ya da rol değişince yeni anahtar beklemeden geçerli olur, silinen hesap hemen erişimini kaybeder.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets);
    const rule = this.reflector.getAllAndOverride<AuthRule>(AUTH_KEY, targets);
    const req = ctx.switchToHttp().getRequest();
    const user = await this.resolve(req.headers.authorization);

    if (isPublic) {
      if (user) req.user = user;
      return true;
    }
    if (!rule || !user) throw Errors.unauthenticated();
    if (rule.roles?.length && !rule.roles.some((r) => user.roles.includes(r))) throw Errors.forbidden();
    if (rule.level && user.level < rule.level) throw Errors.levelRequired(rule.level);
    req.user = user;
    return true;
  }

  private async resolve(header?: string): Promise<AuthUser | null> {
    const m = /^Bearer (.+)$/.exec(header ?? '');
    if (!m) return null;
    let payload: { sub: string; sid?: string };
    try {
      payload = await this.jwt.verifyAsync(m[1]);
    } catch {
      return null;
    }
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!u || u.deletedAt) return null;
    if (payload.sid && payload.sid !== 'none') {
      const s = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (!s || s.revokedAt) return null;
    }
    return { id: u.id, level: u.verifyLevel, roles: u.roles, sessionId: payload.sid && payload.sid !== 'none' ? payload.sid : null };
  }
}
