export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radii;

/**
 * Semantic card radius ladder (design system v2) - one related family so
 * cards stop inventing their own corners:
 *   chip     small pills / chips / stat pills
 *   compact  compact cards (Today pair, list rows, game tiles)
 *   media    standard media cards (Explore, Daily, progress module)
 *   hero     the one primary hero card on a screen
 */
export const cardRadii = {
  chip: 16,
  compact: 20,
  media: 24,
  hero: 28,
} as const;
