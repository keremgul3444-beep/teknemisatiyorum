/**
 * "Liman" tasarım dili — uygulama ve site aynı değerleri kullanır (tek kaynak).
 * Açık zemin, lacivert ana renk, turuncu vurgu (yalnızca "İlan ver" ve eşleşme gibi tek tük yerlerde).
 * Turuncu üstüne beyaz yazı okunmaz: turuncu yazı gerekiyorsa `accentText` + `accentSoft` kullanılır.
 */
export const colors = {
  bg: '#F6F8FA', card: '#FFFFFF', primary: '#0B3B5C', primarySoft: '#8DA6BA', text: '#0E1B26',
  muted: '#556270', surface: '#EEF2F6', line: '#E3E8EE', success: '#1E7A4C', warning: '#9A5B00',
  danger: '#C2281E', white: '#FFFFFF', overlay: 'rgba(14,27,38,0.45)',
  accent: '#F2652B', accentSoft: '#FFF1EA', accentText: '#B23F0E',
} as const;
export const radius = { card: 20, button: 14, chip: 999, sm: 10, xs: 4, lg: 24, pill: 999 } as const;
export const fontFamilies = { heading: 'Bricolage Grotesque', body: 'Figtree' } as const;
/** Fotoğrafı olmayan ilanın yer tutucusu: gökyüzü → deniz. */
export const gradients: [string, string][] = [
  ['#BFD9EA', '#2F6F98'], ['#CFE3DA', '#2C7A6B'], ['#C9D7E6', '#3E6E8E'],
  ['#D8E6EE', '#5A8FA8'], ['#B9CCE0', '#2B4F73'], ['#D3E2E8', '#3F7488'],
];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** Web için CSS değişkenleri, `<html style>` üzerine konacak harita (ayrı <style> etiketi tarayıcı eklentileriyle çakışıyordu). */
export function cssVariableMap(): Record<string, string> {
  const c = Object.entries(colors).map(([k, v]) => [`--c-${kebab(k)}`, v] as const);
  const r = Object.entries(radius).map(([k, v]) => [`--r-${kebab(k)}`, `${v}px`] as const);
  return Object.fromEntries([...c, ...r]);
}
/** Aynı değişkenler `:root{...}` metni olarak (statik CSS üretimi için). */
export function cssVariables(): string {
  return `:root{${Object.entries(cssVariableMap()).map(([k, v]) => `${k}:${v}`).join(';')}}`;
}
