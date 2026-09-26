import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { AuthService } from './auth.service';
import { phoneSchema } from './phone';
import { env } from '../../config/env';

const otpBody = z.object({ phone: phoneSchema });
const verifyBody = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), deviceName: z.string().max(60).default('Cihaz') });
const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** IP başına saatte en fazla 10 kod isteği. */
  @Public()
  @Throttle({ default: { limit: () => env().OTP_IP_LIMIT, ttl: 60 * 60_000 } })
  @Post('otp')
  async otp(@Body(new ZodPipe(otpBody)) b: z.infer<typeof otpBody>, @Res({ passthrough: true }) res: Response) {
    const code = await this.auth.requestOtp(b.phone);
    const e = env();
    if (e.DEV_OTP_ECHO === '1' && e.NODE_ENV !== 'production') {
      res.status(200);
      return { devCode: code };
    }
    res.status(204);
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  verify(@Body(new ZodPipe(verifyBody)) b: z.infer<typeof verifyBody>) {
    return this.auth.verifyOtp(b.phone, b.code, b.deviceName);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshBody)) b: z.infer<typeof refreshBody>) {
    return this.auth.refresh(b.refreshToken);
  }

  @Auth()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() u: AuthUser) {
    await this.auth.logout(u.sessionId);
  }

  @Auth()
  @Get('sessions')
  sessions(@CurrentUser() u: AuthUser) {
    return this.auth.sessions(u.id, u.sessionId);
  }

  @Auth()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.auth.revokeSession(u.id, id);
  }
}
