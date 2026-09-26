import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { Errors } from './errors';

/** Gövde ya da sorgu parametresini zod şemasıyla doğrular; bilinmeyen alanlar şemaya göre atılır. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (!r.success) throw Errors.validation(r.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })));
    return r.data;
  }
}
