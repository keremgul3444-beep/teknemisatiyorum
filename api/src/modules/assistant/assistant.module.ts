import { Body, Controller, HttpCode, Ip, Module, Post } from '@nestjs/common';
import { z } from 'zod';
import { OptionalUser, Public, type AuthUser } from '../../common/decorators';
import { ZodPipe } from '../../common/zod.pipe';
import { ClaudeLlmClient, LLM_CLIENT } from '../../adapters/llm';
import { ListingsModule } from '../listings/listings.module';
import { ListingsService } from '../listings/listings.service';
import { AssistantService } from './assistant.service';

const body = z.object({ text: z.string().trim().min(1).max(500) });

@Controller('assistant')
class AssistantController {
  constructor(private readonly assistant: AssistantService, private readonly listings: ListingsService) {}

  @Public()
  @Post('search')
  @HttpCode(200)
  async search(@OptionalUser() u: AuthUser | undefined, @Ip() ip: string, @Body(new ZodPipe(body)) b: z.infer<typeof body>) {
    const r = await this.assistant.search(b.text, { userId: u?.id, ip });
    return {
      query: r.query,
      source: r.source,
      exact: await Promise.all(r.exact.map((l) => this.listings.view(l, u?.id))),
      near: await Promise.all(r.near.map(async (n) => ({ listing: await this.listings.view(n.listing, u?.id), missing: n.missing }))),
    };
  }
}

@Module({
  imports: [ListingsModule],
  controllers: [AssistantController],
  providers: [AssistantService, { provide: LLM_CLIENT, useClass: ClaudeLlmClient }],
})
export class AssistantModule {}
