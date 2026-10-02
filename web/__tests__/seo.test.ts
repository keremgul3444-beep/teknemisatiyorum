import { expect, test } from 'vitest';
import { listingJsonLd, listingMetadata, pageMetadata, websiteJsonLd } from '../src/lib/seo';
import type { ListingView } from '../src/lib/types';

const l: ListingView = {
  id: 'ck9', brand: 'Beneteau', model: 'Oceanis 38', year: 2017, lengthM: 11.5, type: 'yelkenli', price: 150000, currency: 'EUR',
  location: 'Bodrum', description: 'Temiz, bakımlı. '.repeat(30), status: 'published', photos: [{ id: 'f1', url: '/media/f1' }],
  seller: { id: 's', name: 'Deniz', since: 2020, companyName: null }, promo: { featured: false, urgent: false }, badges: [], equipment: [],
};
const SITE = 'https://teknemisatiyorum.com';

test('ilan başlığı, açıklaması, asıl adres ve dil karşılıkları', () => {
  const m = listingMetadata(l, 'tr', SITE);
  expect(m.title).toBe('Satılık Beneteau Oceanis 38 (2017) · Bodrum · €150.000 | teknemisatıyorum');
  expect(String(m.description).length).toBeLessThanOrEqual(160);
  expect(m.alternates?.canonical).toBe(`${SITE}/ilan/beneteau-oceanis-38-2017-ck9`);
  expect(m.alternates?.languages).toMatchObject({ tr: `${SITE}/ilan/beneteau-oceanis-38-2017-ck9`, en: `${SITE}/en/ilan/beneteau-oceanis-38-2017-ck9` });
  expect(JSON.stringify(m.openGraph)).toContain(`${SITE}/media/f1?w=1600`);
});

test('schema.org ürün + teklif; satılmışsa SoldOut', () => {
  const j = listingJsonLd(l, 'tr', SITE) as Record<string, any>;
  expect(j['@type']).toBe('Product');
  expect(j.offers).toMatchObject({ '@type': 'Offer', price: 150000, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' });
  expect((listingJsonLd({ ...l, status: 'sold' }, 'tr', SITE) as any).offers.availability).toBe('https://schema.org/SoldOut');
});

test('kapalı sayfa noindex taşır; ana sayfa asıl adresi', () => {
  expect(pageMetadata({ title: 'x', description: 'y', path: '/giris', locale: 'tr', noindex: true, siteUrl: SITE }).robots).toMatchObject({ index: false });
  expect(pageMetadata({ title: 'x', description: 'y', path: '/', locale: 'en', siteUrl: SITE }).alternates?.canonical).toBe(`${SITE}/en`);
  expect(pageMetadata({ title: 'x', description: 'y', path: '/', locale: 'tr', siteUrl: SITE }).alternates?.canonical).toBe(SITE);
});

test('KVKK: bireysel satıcının adı Google verisine konmaz; firma adı konabilir', () => {
  const j = JSON.stringify(listingJsonLd(l, 'tr', SITE));
  expect(j).not.toContain('Deniz');
  const firm = listingJsonLd({ ...l, seller: { ...l.seller, companyName: 'Mavi Koy Yatçılık' } }, 'tr', SITE) as any;
  expect(firm.offers.seller).toEqual({ '@type': 'Organization', name: 'Mavi Koy Yatçılık' });
});

test('site işaretlemesinde Google\'ın artık kullanmadığı arama kutusu yok', () => {
  expect(websiteJsonLd(SITE)).not.toHaveProperty('potentialAction');
  expect(websiteJsonLd(SITE)).toMatchObject({ '@type': 'WebSite', url: SITE });
});
