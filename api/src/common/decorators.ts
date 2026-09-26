import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const PUBLIC_KEY = 'tms:public';
export const AUTH_KEY = 'tms:auth';

export interface AuthRule { level?: 0 | 1 | 2 | 3; roles?: Role[] }
export interface AuthUser { id: string; level: number; roles: Role[]; sessionId: string | null }

/** Giriş gerektirmeyen uç nokta. Bildirim olmayan her uç nokta varsayılan olarak kapalıdır. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Giriş gerektiren uç nokta; isteğe bağlı asgari doğrulama seviyesi ve roller. */
export const Auth = (rule: AuthRule = {}) => SetMetadata(AUTH_KEY, rule);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/** @Public uç noktalarda isteğe bağlı kullanıcı (misafir ise undefined). */
export const OptionalUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => ctx.switchToHttp().getRequest().user);
