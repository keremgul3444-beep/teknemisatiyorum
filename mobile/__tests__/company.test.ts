import { canRemove, isManager, toPhone, type CompanyDetail } from '@/features/company';

const m = (over: Partial<CompanyDetail['members'][number]>) => ({ userId: 'u', role: 'staff' as const, name: 'A', phone: null, me: false, ...over });

test('personeli yalnızca sahip ve yönetici çıkarır; sahip ve kişinin kendisi çıkarılamaz', () => {
  expect(isManager({ myRole: 'staff' })).toBe(false);
  expect(canRemove({ myRole: 'owner' }, m({}))).toBe(true);
  expect(canRemove({ myRole: 'admin' }, m({ role: 'owner' }))).toBe(false);
  expect(canRemove({ myRole: 'admin' }, m({ me: true }))).toBe(false);
  expect(canRemove({ myRole: 'staff' }, m({}))).toBe(false);
});

test('telefon numarası +90 biçimine çevrilir', () => {
  expect(toPhone('532 123 45 67')).toBe('+905321234567');
  expect(toPhone('0532 123 45 67')).toBe('+905321234567');
  expect(toPhone('+90 532 123 45 67')).toBe('+905321234567');
  expect(toPhone('212 123 45 67')).toBeNull();
  expect(toPhone('532')).toBeNull();
});
