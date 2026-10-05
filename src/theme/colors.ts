const palette = {
  cream50: '#FBF3E3',
  cream100: '#F3E5C9',
  cream200: '#EADCC0',
  cream300: '#E0CFAC',
  // Warm secondary surface - a step warmer than cream200 without going as
  // deep as the terracotta accent, used for "warm content" surfaces that
  // shouldn't read as plain cream (Section "subtle warm secondary surface").
  cream400: '#E8D3AC',
  brown300: '#C9A876',
  brown500: '#8B6B3D',
  brown700: '#5C4326',
  green500: '#3C6E47',
  green600: '#2F5233',
  green700: '#1F3A24',
  // Deep feature surface - a full-bleed dark-green section background
  // (Section "featured dark-green surface"), darker than any pressed/
  // active state so it reads as a distinct elevation, not a button.
  green900: '#132018',
  gold400: '#E8B93D',
  gold600: '#C79A2E',
  silver400: '#9AA6AC',
  red500: '#D64545',
  // Destructive button FILL: white on red500 measured 4.38:1 (AA needs 4.5).
  red600: '#C53F3F',
  // Real terracotta accent (Section "Use terracotta selectively for
  // cultural warmth") - distinct from tileOrange below, which stays as
  // the existing Home culture-tile tone so nothing that already renders
  // with it shifts color.
  terracotta500: '#B9622F',
  terracotta700: '#7A3F1E',
  // TEXT-only shades of the accents: small overline text in terracotta500
  // measured 3.48:1 (cream100) / 3.92:1 (cream50) and gold600 2.08:1 -
  // below AA 4.5:1. These clear it on cream100 (4.65 / 4.62) and cream50
  // (5.24 / 5.21), not on cream200 (~4.25); the fills and decorative uses
  // keep the brand shades.
  terracotta600: '#9B5227',
  gold800: '#7E621D',
  tileGreen: '#33482F',
  tileOrange: '#B9793A',
  tileRed: '#7A3226',
  tileTeal: '#3D6E72',
  tilePurple: '#5B4B7A',
  ink900: '#2B2019',
  ink600: '#6B5A47',
  // Was #9C8A73 (~2.7:1), then #786550 - axe measured 4.47:1 on cream100
  // (2026-10-05), still under WCAG AA 4.5:1. #74614C: 4.74 on cream100,
  // 5.35 on cream50 (4.36 on cream200 - avoid muted text there), still
  // visibly lighter than ink600 (textSecondary).
  ink400: '#74614C',
  white: '#FFFFFF',
} as const;

export const colors = {
  background: palette.cream100,
  surface: palette.cream50,
  surfaceAlt: palette.cream200,
  surfaceBorder: palette.cream300,
  /** Warm secondary surface - "content that isn't the default card but
   * also isn't a full feature section" (Section "subtle warm secondary
   * surface"). Use instead of another plain `surface` card when a block
   * should feel warmer without borrowing the terracotta accent's weight. */
  surfaceWarm: palette.cream400,
  /** Full-bleed dark-green feature-section background (Section "featured
   * dark-green surface") - for a hero/highlight block that should read as
   * a distinct elevation, not another cream card. Pair with `textOnDark`. */
  surfaceFeature: palette.green900,

  primary: palette.green600,
  primaryPressed: palette.green700,
  primaryMuted: palette.green500,

  accentGold: palette.gold400,
  accentGoldPressed: palette.gold600,
  accentSilver: palette.silver400,
  accentBrown: palette.brown500,
  accentBrownDark: palette.brown700,
  /** Terracotta accent - cultural warmth, used selectively (a badge, a
   * highlight, a "hero" tag), never as a default card border. */
  accentTerracotta: palette.terracotta500,
  accentTerracottaDark: palette.terracotta700,
  /** Terracotta for TEXT on cream (AA 4.5:1); accentTerracotta stays for fills/marks. */
  accentTerracottaText: palette.terracotta600,
  /** Gold for TEXT on cream (AA 4.5:1); accentGold* stay for fills/marks. */
  accentGoldText: palette.gold800,

  danger: palette.red500,
  /** Fill behind white text on destructive buttons (AA: 5.05:1 with white). */
  dangerFill: palette.red600,

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

  // --- Semantic roles (design system v2) -------------------------------
  // Aliases over the same palette so new components speak in roles, not
  // swatches. Existing tokens above keep working unchanged.
  /** Raised cream surface (cards that sit on the background). */
  surfaceElevated: palette.cream50,
  /** Quiet tonal surface (tracks, idle chips, medallions). */
  surfaceMuted: palette.cream200,
  /** Hairline separators / idle chip outline - never a card border. */
  borderSubtle: palette.cream300,
  success: palette.green500,
  warning: palette.gold600,
  error: palette.red500,
  /** Secondary text on photography / dark surfaces. */
  textOnDarkSecondary: 'rgba(251,243,227,0.84)',
  /** Photo scrims - forest-tinted, never pure black. */
  scrimTop: 'rgba(19,32,24,0.28)',
  scrimClear: 'rgba(19,32,24,0)',
  scrimBottom: 'rgba(19,32,24,0.9)',
  /** Small translucent chip over photography (eyebrow / status). */
  chipOnDark: 'rgba(19,32,24,0.55)',
} as const;

export type ColorToken = keyof typeof colors;
