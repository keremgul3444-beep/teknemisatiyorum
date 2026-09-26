/** Zamanı enjekte edilebilir kılar; testler süre dolması gibi durumları gerçek bekleme olmadan dener. */
export const CLOCK = Symbol('CLOCK');
export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };
