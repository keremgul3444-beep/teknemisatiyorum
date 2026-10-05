import { expect, test } from 'vitest';
import { androidAssetLinks, appleAssociation } from '../src/lib/appLinks';

const FP = Array.from({ length: 32 }, () => 'AB').join(':');

test('iOS ve Android doğrulama dosyaları; ayar yoksa ya da bozuksa sunulmaz', () => {
  expect(appleAssociation('')).toBeNull();
  expect(appleAssociation('ABCDE12345')).toEqual({ applinks: { details: [{ appIDs: ['ABCDE12345.com.teknemisatiyorum.app'], components: [{ '/': '/ilan/*' }, { '/': '/en/ilan/*' }] }] } });
  expect(androidAssetLinks('')).toBeNull();
  expect(androidAssetLinks('bozuk')).toBeNull();
  expect(androidAssetLinks(` ${FP.toLowerCase()} `)?.[0].target).toEqual({ namespace: 'android_app', package_name: 'com.teknemisatiyorum.app', sha256_cert_fingerprints: [FP] });
});
