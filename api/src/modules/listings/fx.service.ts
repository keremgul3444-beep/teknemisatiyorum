import { Body, Controller, Get, Injectable, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { CURRENCIES, DEMO_RATES, type Rates } from '@tms/shared';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { Auth, CurrentUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';

/** Fiyat karşılaştırmasında kullanılan kurlar. Tabloda olmayan birim için demo kuru kullanılır. */
@Injectable()
export class FxService {
  constructor(private readonly prisma: PrismaService) {}

  async rates(): Promise<Rates> {
    const rows = await this.prisma.fxRate.findMany();
    const r: Rates = { ...DEMO_RATES, TRY: 1 };
    rows.forEach((x) => { r[x.currency] = x.rateToTry; });
    return r;
  }
}

const rateBody = z.object({ rateToTry: z.number().positive().max(100000) });
const currencyParam = z.enum(CURRENCIES);

@Controller()
export class FxController {
  constructor(private readonly fx: FxService, private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Public()
  @Get('fx')
  rates() {
    return this.fx.rates();
  }

  @Auth({ roles: ['admin'] })
  @Put('admin/fx/:currency')
  async set(@CurrentUser() u: AuthUser, @Param('currency', new ZodPipe(currencyParam)) currency: z.infer<typeof currencyParam>, @Body(new ZodPipe(rateBody)) b: z.infer<typeof rateBody>) {
    const row = await this.prisma.fxRate.upsert({
      where: { currency }, create: { currency, rateToTry: b.rateToTry, updatedById: u.id }, update: { rateToTry: b.rateToTry, updatedById: u.id },
    });
    await this.audit.log(u.id, 'audit.fxUpdated', { currency, rate: String(b.rateToTry) }, 'fx', currency);
    return row;
  }
}
