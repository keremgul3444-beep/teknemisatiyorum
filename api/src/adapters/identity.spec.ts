import { IdentityServiceDown, NviIdentityVerifier } from './identity';

// Algoritmaya uyan örnek numara (gerçek bir kişiye ait değil).
const TCKN = '10000000146';
const reply = (ok: boolean) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><TCKimlikNoDogrulaResponse xmlns="http://tckimlik.nvi.gov.tr/WS"><TCKimlikNoDogrulaResult>${ok}</TCKimlikNoDogrulaResult></TCKimlikNoDogrulaResponse></soap:Body></soap:Envelope>`;

test('NVİ sorgusu: ad ve soyad Türkçe büyük harfle, XML kaçışlı gider; sonuç okunur', async () => {
  let sent = '';
  const fake = (async (_url: string, init: RequestInit) => { sent = String(init.body); return new Response(reply(true), { status: 200 }); }) as unknown as typeof fetch;
  const ok = await new NviIdentityVerifier(fake).verify({ tckn: TCKN, firstName: 'ilkay', lastName: 'Işık<x>', birthYear: 1988 });
  expect(ok).toBe(true);
  expect(sent).toContain('<Ad>İLKAY</Ad>');
  expect(sent).toContain('<Soyad>IŞIK&lt;X&gt;</Soyad>');
  expect(sent).toContain(`<TCKimlikNo>${TCKN}</TCKimlikNo>`);
});

test('eşleşmeyen kişi false; algoritmaya uymayan numara servise hiç gitmez', async () => {
  let calls = 0;
  const fake = (async () => { calls++; return new Response(reply(false), { status: 200 }); }) as unknown as typeof fetch;
  const v = new NviIdentityVerifier(fake);
  expect(await v.verify({ tckn: TCKN, firstName: 'A', lastName: 'B', birthYear: 1990 })).toBe(false);
  expect(await v.verify({ tckn: '12345678901', firstName: 'A', lastName: 'B', birthYear: 1990 })).toBe(false);
  expect(calls).toBe(1);
});

test('servis yanıt vermezse "geçersiz" değil servis hatası', async () => {
  const down = (async () => new Response('hata', { status: 500 })) as unknown as typeof fetch;
  await expect(new NviIdentityVerifier(down).verify({ tckn: TCKN, firstName: 'A', lastName: 'B', birthYear: 1990 })).rejects.toBeInstanceOf(IdentityServiceDown);
});
