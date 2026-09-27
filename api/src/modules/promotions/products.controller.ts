import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Satıştaki öne çıkarma ürünleri; site ve uygulama fiyatı (kuruş). */
  @Public()
  @Get()
  async list() {
    const rows = await this.prisma.product.findMany({ where: { active: true }, orderBy: [{ kind: 'asc' }, { days: 'asc' }] });
    return rows.map((p) => ({
      code: p.code, kind: p.kind, days: p.days, priceWebKurus: p.priceWebKurus, priceAppKurus: p.priceAppKurus,
      iosProductId: p.iosProductId, androidProductId: p.androidProductId, isTrialPrice: p.isTrialPrice,
    }));
  }
}
