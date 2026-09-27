import { expect, test } from 'vitest';
import { sameOrigin, securityHeaders } from '../src/lib/security';

test('girişli sayfalar: nonce ile sıkı betik politikası', () => {
  const h = securityHeaders({ nonce: 'abc123', isProd: true });
  expect(h['Content-Security-Policy']).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  expect(h['Content-Security-Policy']).not.toContain('unsafe-inline\'; style');
  expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(h['Strict-Transport-Security']).toContain('max-age=');
  expect(h['X-Content-Type-Options']).toBe('nosniff');
});

test('önbellekli herkese açık sayfalar: nonce yok ama dış betik de yok', () => {
  const h = securityHeaders({ isProd: false });
  const csp = h['Content-Security-Policy'];
  expect(csp).toMatch(/script-src 'self' 'unsafe-inline'/);
  expect(csp).not.toMatch(/https?:\/\/(?!127\.0\.0\.1)/);
  expect(csp).toContain("object-src 'none'");
  expect(h['Strict-Transport-Security']).toBeUndefined();
});

test('Origin denetimi', () => {
  const req = (origin: string | null, host = 'localhost:3001') =>
    new Request('http://localhost:3001/api/x', { method: 'POST', headers: { host, ...(origin ? { origin } : {}) } });
  expect(sameOrigin(req('http://localhost:3001'))).toBe(true);
  expect(sameOrigin(req('https://kotu.site'))).toBe(false);
  expect(sameOrigin(req(null))).toBe(false);
  expect(sameOrigin(req('bozuk'))).toBe(false);
});
