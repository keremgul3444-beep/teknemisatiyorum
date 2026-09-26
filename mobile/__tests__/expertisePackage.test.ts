import { defaultPackageId, isPopularPackage } from '@/features/expertise';

const pkgs = [{ id: 'cm-a' }, { id: 'cm-b' }, { id: 'cm-c' }];

test('varsayılan paket veri kaynağından bağımsız olarak ortadaki (önerilen) paket', () => {
  expect(defaultPackageId(pkgs)).toBe('cm-b');
  expect(defaultPackageId([{ id: 'x1' }])).toBe('x1');
  expect(defaultPackageId([])).toBeUndefined();
});

test('"en çok tercih edilen" rozeti kimliğe değil sıraya bağlı', () => {
  expect(isPopularPackage(pkgs, 'cm-b')).toBe(true);
  expect(isPopularPackage(pkgs, 'cm-a')).toBe(false);
});
