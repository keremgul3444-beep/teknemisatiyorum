export const colors = {
  bg: '#F4EFE6', card: '#FFFCF6', primary: '#0F6E68', primarySoft: '#5FA8A0', text: '#1D2B2A',
  muted: '#6B736B', surface: '#E7DFD0', line: '#E2D9C8', success: '#2E7D4F', warning: '#C98A1B',
  danger: '#B3261E', white: '#FFFFFF', overlay: 'rgba(29,43,42,0.45)',
} as const;
export const radius = { card: 18, button: 12, chip: 14, sm: 8, xs: 4, lg: 24, pill: 999 } as const;
export const fonts = {
  heading: 'SpaceGrotesk_700Bold', headingMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular', bodySemi: 'Inter_600SemiBold', bodyBold: 'Inter_700Bold',
} as const;
export const space = (n: number) => n * 4;
export const type = {
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
} as const;
export const gradients: [string, string][] = [
  ['#5FA8A0', '#0F6E68'], ['#7FB7C9', '#1F5E7A'], ['#9DB8A0', '#3E6B4F'],
  ['#C9B48A', '#7A5A2E'], ['#8FA9C4', '#2F4C6E'], ['#6FB3A8', '#1D4D4A'],
];
