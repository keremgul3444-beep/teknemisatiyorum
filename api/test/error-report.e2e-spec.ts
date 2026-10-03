import { Controller, Get } from '@nestjs/common';
import { createTestApp, type TestApp } from './setup';
import { Public } from '../src/common/decorators';
import { resetReportWindow } from '../src/adapters/error-report';

@Controller('deneme-hata')
class BoomController {
  @Public()
  @Get(':id')
  boom() {
    throw new Error('beklenmeyen');
  }
}

let t: TestApp;
const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
beforeAll(async () => {
  process.env.ERROR_DSN = 'https://anahtar@hata.ornek.com/9';
  t = await createTestApp({ controllers: [BoomController] });
  resetReportWindow();
});
afterAll(async () => { await t.close(); delete process.env.ERROR_DSN; fetchSpy.mockRestore(); });

test('beklenmeyen hata 500 döner ve hata takibine yol kalıbıyla (gerçek kimlik ve sorgu olmadan) bildirilir', async () => {
  const r = await t.http().get('/deneme-hata/05321234567?tel=05321234567');
  expect(r.status).toBe(500);
  expect(r.body).toEqual({ code: 'INTERNAL', messageKey: 'errors.internal' });
  await new Promise((ok) => setTimeout(ok, 50));
  const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes('hata.ornek.com'));
  expect(call).toBeTruthy();
  const body = String((call![1] as { body: string }).body);
  expect(body).toContain('/deneme-hata/:id');
  expect(body).not.toContain('05321234567');
});

test('bilinen hatalar (404, doğrulama) bildirilmez', async () => {
  fetchSpy.mockClear();
  expect((await t.http().get('/yok-boyle-bir-yol')).status).toBe(404);
  await new Promise((ok) => setTimeout(ok, 50));
  expect(fetchSpy.mock.calls.filter((c) => String(c[0]).includes('hata.ornek.com'))).toHaveLength(0);
});
