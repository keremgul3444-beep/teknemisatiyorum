export { colors, radius, gradients } from '@tms/shared';
export const fonts = {
  heading: 'BricolageGrotesque_800ExtraBold', headingMedium: 'BricolageGrotesque_600SemiBold',
  body: 'Figtree_400Regular', bodySemi: 'Figtree_600SemiBold', bodyBold: 'Figtree_700Bold',
} as const;
export const space = (n: number) => n * 4;
export const type = {
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  bodySemi: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
} as const;
