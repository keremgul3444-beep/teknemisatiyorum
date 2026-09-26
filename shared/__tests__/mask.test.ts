import { maskPhone } from '../src/mask';

test('cep numarası maskelenir, son iki hane görünür', () => {
  expect(maskPhone('+905321234512')).toBe('+90 5•• ••• •• 12');
});
test('sabit hat da aynı biçimde maskelenir', () => {
  expect(maskPhone('+902523130088')).toBe('+90 2•• ••• •• 88');
});
test('beklenmeyen biçim tamamen gizlenir', () => {
  expect(maskPhone('abc')).toBe('•••');
});
