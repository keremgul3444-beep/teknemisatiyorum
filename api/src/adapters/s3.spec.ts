import http from 'http';
import type { AddressInfo } from 'net';
import { S3Client, signV4 } from './s3';

test('imza AWS belgelerindeki örnekle aynı (GET /test.txt, Range)', () => {
  const { signature } = signV4({
    method: 'GET', path: '/test.txt',
    headers: { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9', 'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'x-amz-date': '20130524T000000Z' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    region: 'us-east-1', accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', amzDate: '20130524T000000Z',
  });
  expect(signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
});

test('yükle, oku, sil; olmayan dosya null; her istek imzalı', async () => {
  const store = new Map<string, Buffer>();
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    seen.push(String(req.headers.authorization));
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const k = req.url!;
      if (req.method === 'PUT') { store.set(k, Buffer.concat(chunks)); res.end(); }
      else if (req.method === 'GET') { const b = store.get(k); res.statusCode = b ? 200 : 404; res.end(b ?? ''); }
      else { store.delete(k); res.statusCode = 204; res.end(); }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const s3 = new S3Client({ endpoint: `http://127.0.0.1:${port}`, region: 'auto', bucket: 'tms', accessKeyId: 'k', secretAccessKey: 's' });
  await s3.put('public/ab/abc', Buffer.from('foto'));
  expect(store.has('/tms/public/ab/abc')).toBe(true);
  expect((await s3.get('public/ab/abc'))?.toString()).toBe('foto');
  await s3.remove('public/ab/abc');
  expect(await s3.get('public/ab/abc')).toBeNull();
  expect(seen.every((a) => a.startsWith('AWS4-HMAC-SHA256 Credential=k/'))).toBe(true);
  server.close();
});
