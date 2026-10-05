import { appPathFor } from '@/features/deepLink';

test('site bağlantıları uygulama ekranına çevrilir', () => {
  expect(appPathFor('https://teknemisatiyorum.com/ilan/bavaria-cruiser-41-2016-cmabc123')).toBe('/ilan/cmabc123');
  expect(appPathFor('https://teknemisatiyorum.com/en/ilan/leopard-45-2020-cmxyz9')).toBe('/ilan/cmxyz9');
  expect(appPathFor('https://teknemisatiyorum.com/ilan/cmshort1')).toBe('/ilan/cmshort1');
  expect(appPathFor('/ilan/x-2010-abc?utm=1')).toBe('/ilan/abc');
  expect(appPathFor('https://teknemisatiyorum.com/satilik/yelkenli')).toBe('/ilanlar');
  expect(appPathFor('https://teknemisatiyorum.com/kvkk')).toBe('/');
  expect(appPathFor('teknemisatiyorum://ilan/abc')).toBe('teknemisatiyorum://ilan/abc');
});

test('uygulama içi yollar ve Expo Go adresleri değişmez', () => {
  expect(appPathFor('/sohbet/c1')).toBe('/sohbet/c1');
  expect(appPathFor('exp://192.168.1.5:8081/--/ilan/abc')).toBe('exp://192.168.1.5:8081/--/ilan/abc');
});
