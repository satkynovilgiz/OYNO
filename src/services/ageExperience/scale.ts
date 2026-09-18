import type { AgeExperienceConfig } from './config';

export type CardScale = AgeExperienceConfig['cardScale'];

/**
 * Turns AgeExperienceConfig.cardScale into an actual numeric style value
 * (font size, icon size, padding, aspect ratio...) - the one place every
 * screen goes through to scale a number by age, so "child gets bigger,
 * adult gets denser" stays a single, consistent four-step ladder
 * (large > medium > compact > dense) instead of each screen inventing its
 * own breakpoints. Every call site must supply all four values - there is
 * no silent fallback, so a missing tier fails at the call site, not at
 * render time for one specific age.
 */
export function resolveByCardScale<T>(cardScale: CardScale, values: Record<CardScale, T>): T {
  return values[cardScale];
}

/** Minimum comfortable tap target (44pt, Apple HIG / Material) never
 * shrinks below the accessible floor even at the 'dense' (adult) tier -
 * only the *visual* card/icon size shrinks, the tappable area doesn't. */
const ACCESSIBLE_MIN_TOUCH_TARGET = 44;

/** Visual touch-target size per cardScale (spec "larger touch targets" for
 * child, "smaller, more refined controls" for adult) - clamped so it never
 * reads as a real accessibility regression. */
export function resolveTouchTargetSize(cardScale: CardScale): number {
  return Math.max(
    ACCESSIBLE_MIN_TOUCH_TARGET,
    resolveByCardScale(cardScale, { large: 56, medium: 48, compact: 44, dense: 44 }),
  );
}
