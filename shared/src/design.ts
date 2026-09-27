/** "Kıyı Sıcak" tasarım dili — uygulama ve site aynı değerleri kullanır (tek kaynak). */
export const colors = {
  bg: '#F4EFE6', card: '#FFFCF6', primary: '#0F6E68', primarySoft: '#5FA8A0', text: '#1D2B2A',
  muted: '#5B625B', surface: '#E7DFD0', line: '#E2D9C8', success: '#2E7D4F', warning: '#C98A1B',
  danger: '#B3261E', white: '#FFFFFF', overlay: 'rgba(29,43,42,0.45)',
} as const;
export const radius = { card: 18, button: 12, chip: 14, sm: 8, xs: 4, lg: 24, pill: 999 } as const;
export const fontFamilies = { heading: 'Space Grotesk', body: 'Inter' } as const;
export const gradients: [string, string][] = [
  ['#5FA8A0', '#0F6E68'], ['#7FB7C9', '#1F5E7A'], ['#9DB8A0', '#3E6B4F'],
  ['#C9B48A', '#7A5A2E'], ['#8FA9C4', '#2F4C6E'], ['#6FB3A8', '#1D4D4A'],
];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** Web için `:root{...}` CSS değişkenleri. */
export function cssVariables(): string {
  const c = Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}:${v}`);
  const r = Object.entries(radius).map(([k, v]) => `--r-${kebab(k)}:${v}px`);
  return `:root{${[...c, ...r].join(';')}}`;
}
