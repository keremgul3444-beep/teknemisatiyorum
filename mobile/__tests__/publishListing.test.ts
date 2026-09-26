import { createPublisher } from '@/features/publishListing';

const draft = { brand: 'B', model: 'M', year: 2018, lengthM: 10, type: 'yelkenli', price: 1, currency: 'EUR', location: 'Bodrum' } as never;

function fakeApi(failSubmitTimes = 0) {
  const calls: string[] = [];
  let n = 0;
  let fails = failSubmitTimes;
  return {
    calls,
    deps: {
      post: jest.fn(async (path: string) => {
        calls.push(`POST ${path}`);
        if (path === '/listings') return { id: `L${++n}` };
        if (path.endsWith('/submit') && fails-- > 0) throw new Error('LEVEL_REQUIRED');
        return {};
      }),
      patch: jest.fn(async (path: string) => { calls.push(`PATCH ${path}`); return {}; }),
      upload: jest.fn(async (uri: string) => `F-${uri}`),
    },
  };
}

test('gönderim yarıda kalırsa yeniden denemede yeni taslak açılmaz, fotoğraf yeniden yüklenmez', async () => {
  const f = fakeApi(1);
  const publish = createPublisher(f.deps);
  await expect(publish(draft, { photoUris: ['a', 'b'] })).rejects.toThrow('LEVEL_REQUIRED');
  await expect(publish(draft, { photoUris: ['a', 'b'] })).resolves.toBe('L1');
  expect(f.calls.filter((c) => c === 'POST /listings')).toHaveLength(1);
  expect(f.calls).toContain('PATCH /listings/L1');
  expect(f.deps.upload).toHaveBeenCalledTimes(2);
});

test('başarılı gönderimden sonra yeni ilan yeni taslak açar', async () => {
  const f = fakeApi();
  const publish = createPublisher(f.deps);
  expect(await publish(draft, {})).toBe('L1');
  expect(await publish(draft, {})).toBe('L2');
});
