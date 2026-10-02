import { DEMO_RATES, toTRY as toTRYWith, toEUR as toEURWith, type Currency, type Rates } from '@tms/shared';

export { DEMO_RATES, formatPrice, type Rates } from '@tms/shared';

// Gerçek modda sunucunun kur tablosu (yönetici günceller); demo modunda örnek kurlar.
let current: Rates = DEMO_RATES;
export const setRates = (r: Rates) => { current = r; };
export const resetRates = () => { current = DEMO_RATES; };
export const toTRY = (amount: number, c: Currency) => toTRYWith(amount, c, current);
export const toEUR = (amount: number, c: Currency) => toEURWith(amount, c, current);
