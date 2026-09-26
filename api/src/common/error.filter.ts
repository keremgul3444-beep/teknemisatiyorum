import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { AppError, type ErrorBody } from './errors';

const BY_STATUS: Record<number, ErrorBody> = {
  400: { code: 'BAD_REQUEST', messageKey: 'errors.badRequest' },
  401: { code: 'UNAUTHENTICATED', messageKey: 'errors.unauthenticated' },
  403: { code: 'FORBIDDEN', messageKey: 'errors.forbidden' },
  404: { code: 'NOT_FOUND', messageKey: 'errors.notFound' },
  413: { code: 'TOO_LARGE', messageKey: 'errors.tooLarge' },
  415: { code: 'UNSUPPORTED_TYPE', messageKey: 'errors.unsupportedType' },
  429: { code: 'RATE_LIMITED', messageKey: 'errors.rateLimited' },
};

/** Her hatayı ortak biçime çevirir; beklenmeyen hatalarda iç ayrıntıyı yalnızca sunucu kaydına yazar. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof AppError) return res.status(err.getStatus()).json(err.getResponse());
    if (err instanceof ThrottlerException) return res.status(429).json(BY_STATUS[429]);
    if (err instanceof HttpException) {
      const status = err.getStatus();
      return res.status(status).json(BY_STATUS[status] ?? { code: `HTTP_${status}`, messageKey: 'errors.generic' });
    }
    this.log.error(err instanceof Error ? err.stack : String(err));
    return res.status(500).json({ code: 'INTERNAL', messageKey: 'errors.internal' });
  }
}
