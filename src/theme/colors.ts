const palette = {
  cream50: '#FBF3E3',
  cream100: '#F3E5C9',
  cream200: '#EADCC0',
  cream300: '#E0CFAC',
  brown300: '#C9A876',
  brown500: '#8B6B3D',
  brown700: '#5C4326',
  green500: '#3C6E47',
  green600: '#2F5233',
  green700: '#1F3A24',
  gold400: '#E8B93D',
  gold600: '#C79A2E',
  silver400: '#9AA6AC',
  red500: '#D64545',
  tileGreen: '#33482F',
  tileOrange: '#B9793A',
  tileRed: '#7A3226',
  tileTeal: '#3D6E72',
  tilePurple: '#5B4B7A',
  ink900: '#2B2019',
  ink600: '#6B5A47',
  ink400: '#9C8A73',
  white: '#FFFFFF',
} as const;

export const colors = {
  background: palette.cream100,
  surface: palette.cream50,
  surfaceAlt: palette.cream200,
  surfaceBorder: palette.cream300,

  primary: palette.green600,
  primaryPressed: palette.green700,
  primaryMuted: palette.green500,

  accentGold: palette.gold400,
  accentGoldPressed: palette.gold600,
  accentSilver: palette.silver400,
  accentBrown: palette.brown500,
  accentBrownDark: palette.brown700,

  danger: palette.red500,

  textPrimary: palette.ink900,
  textSecondary: palette.ink600,
  textMuted: palette.ink400,
  textOnDark: palette.white,
  textOnPrimary: palette.white,

  border: palette.brown300,

  tiles: {
    culture: palette.tileGreen,
    food: palette.tileOrange,
    music: palette.tileRed,
    map: palette.tileTeal,
  },

  /** Category tag colors for Explore discoveries - kept separate from
   * `tiles` above since the category names overlap but the semantics
   * don't (e.g. tiles.food is a Home culture-tile tone, not the same
   * "food" as a discovery category). Reused by Location pages and the
   * Collection screen wherever the same category tagging appears. */
  discovery: {
    nature: palette.tileGreen,
    culture: palette.tileOrange,
    animals: palette.tilePurple,
    food: palette.tileRed,
  },

  overlayStart: 'rgba(20, 14, 8, 0)',
  overlayEnd: 'rgba(20, 14, 8, 0.72)',

  shadow: '#3D2B14',
} as const;

export type ColorToken = keyof typeof colors;
