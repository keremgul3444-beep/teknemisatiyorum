import { expect, test } from 'vitest';
import { idFromSlug, listingSlug, mediaUrl, slugPart } from '../src/lib/format';

test('ilan adresi: Türkçe karakter sadeleşir, kimlik sonda', () => {
  const slug = listingSlug({ brand: 'Bavaria', model: 'Cruiser 46 Çift Kabin', year: 2014, id: 'ck1abc' });
  expect(slug).toBe('bavaria-cruiser-46-cift-kabin-2014-ck1abc');
  expect(idFromSlug(slug)).toBe('ck1abc');
  expect(slugPart('Göcek İskele')).toBe('gocek-iskele');
});

test('görsel adresi', () => expect(mediaUrl('f1', 800)).toBe('/media/f1?w=800'));
