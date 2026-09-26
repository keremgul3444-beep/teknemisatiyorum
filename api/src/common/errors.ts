import { HttpException } from '@nestjs/common';

/** Tüm hata yanıtlarının ortak biçimi: `{ code, messageKey, params? }`. Mesaj metni istemcide çevrilir. */
export interface ErrorBody { code: string; messageKey: string; params?: Record<string, unknown> }

export class AppError extends HttpException {
  constructor(code: string, messageKey: string, status: number, params?: Record<string, unknown>) {
    super(params ? { code, messageKey, params } : { code, messageKey }, status);
  }
}

export const Errors = {
  unauthenticated: () => new AppError('UNAUTHENTICATED', 'errors.unauthenticated', 401),
  forbidden: () => new AppError('FORBIDDEN', 'errors.forbidden', 403),
  levelRequired: (level: number) => new AppError('LEVEL_REQUIRED', 'errors.levelRequired', 403, { level }),
  notFound: () => new AppError('NOT_FOUND', 'errors.notFound', 404),
  conflict: (code: string) => new AppError(code, `errors.${code.toLowerCase()}`, 409),
  bad: (code: string, params?: Record<string, unknown>) => new AppError(code, `errors.${code.toLowerCase()}`, 400, params),
  validation: (issues: unknown) => new AppError('VALIDATION', 'errors.validation', 400, { issues }),
  tooMany: (code = 'RATE_LIMITED') => new AppError(code, `errors.${code.toLowerCase()}`, 429),
};
