/** Telefonu destek ekranları için maskeler: ülke kodu, ilk hane ve son iki hane görünür. */
export function maskPhone(phone: string): string {
  const m = /^\+90(\d)(\d{7})(\d{2})$/.exec(phone.replace(/\s/g, ''));
  if (!m) return '•••';
  return `+90 ${m[1]}•• ••• •• ${m[3]}`;
}
