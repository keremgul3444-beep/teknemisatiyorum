import { toAdminListing, toAdminVerification } from '@/services/api/mappers';

test('I-5: onay kuyruğundaki ilan fotoğrafları moderatöre taşınır', () => {
  const item = toAdminListing({ id: 'l1', title: 'Hanse 418', ownerName: 'A', photos: ['/media/f1', '/media/f2'] });
  expect(item.photos).toHaveLength(2);
  expect(item.photos![0]).toMatch(/\/media\/f1$/);
});

test('I-5: belge başvurusu dosyaları ve pasaport bilgileri moderatöre taşınır', () => {
  const item = toAdminVerification({ id: 'v1', kind: 'identity', userName: 'Anna', fileIds: ['f9'], details: { passport: 'U1', nationality: 'DE' } });
  expect(item.fileIds).toEqual(['f9']);
  expect(item.details).toEqual({ passport: 'U1', nationality: 'DE' });
});
