import { expect, test } from 'vitest';
import { buildSitemap } from '../src/lib/sitemap';
import robots from '../src/app/robots';

const SITE = 'https://teknemisatiyorum.com';

test('ilanlar, açık hazır aramalar ve sabit sayfalar; kapalılar yok', () => {
  const s = buildSitemap({
    listings: [{ id: 'ck1', brand: 'Bavaria', model: 'C46', year: 2014, type: 'yelkenli', location: 'Göcek', updatedAt: '2026-09-20T00:00:00Z' }],
    facets: [{ type: 'yelkenli', location: null, count: 5 }, { type: 'yelkenli', location: 'Göcek', count: 3 }, { type: 'gulet', location: 'Bodrum', count: 2 }],
  }, SITE);
  const urls = s.map((x) => x.url);
  expect(urls).toContain(SITE);
  expect(urls).toContain(`${SITE}/ilan/bavaria-c46-2014-ck1`);
  expect(urls).toContain(`${SITE}/satilik/yelkenli`);
  expect(urls).toContain(`${SITE}/satilik/yelkenli/gocek`);
  expect(urls).not.toContain(`${SITE}/satilik/gulet/bodrum`);
  expect(urls).toContain(`${SITE}/usta-ol`);
  expect(urls.some((u) => /\/(hesabim|giris|asistan|odeme)/.test(u))).toBe(false);
  expect(s.find((x) => x.url.endsWith('ck1'))!.alternates!.languages!.en).toBe(`${SITE}/en/ilan/bavaria-c46-2014-ck1`);
  expect(s.find((x) => x.url === SITE)!.alternates!.languages!.en).toBe(`${SITE}/en`);
});

test('robots girişli alanı, ödemeyi ve asistanı kapatır; site haritasını bildirir', () => {
  const r = robots();
  const rule = (Array.isArray(r.rules) ? r.rules[0] : r.rules) as { disallow: string[] };
  for (const p of ['/hesabim', '/odeme', '/giris', '/asistan', '/en/hesabim', '/en/odeme', '/en/giris', '/en/asistan', '/api/']) expect(rule.disallow).toContain(p);
  expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
});
