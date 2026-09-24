/**
 * Interaction presets (design system v2) - the one place press, fade,
 * sheet and success timings live, so features never hardcode their own.
 * All nonessential motion is skipped under Reduce Motion by the primitives
 * that consume these (AnimatedPressable, MediaImage, Toast...).
 *
 *   press       100-150 ms   scale-only, no bounce
 *   transition  180-250 ms   fades, small state changes
 *   entrance    250-400 ms   hero / sheet entrance
 */
export const motion = {
  duration: { press: 120, fast: 180, base: 220, entrance: 320 },
  /** Cards and media tiles: 1 -> 0.985 -> 1. */
  pressSoft: { scale: 0.985, inMs: 100, outMs: 140 },
  /** Buttons, chips, tabs: a slightly firmer squeeze. */
  pressStrong: { scale: 0.96, inMs: 100, outMs: 150 },
  /** Image placeholder -> image. */
  fadeIn: { durationMs: 200 },
  /** Toast / sheet entrance distance + timing. */
  sheetEnter: { distance: 16, durationMs: 240 },
  /** Success check pulse. */
  successPulse: { scale: 1.12, durationMs: 180 },
  /** How long a toast stays up. */
  toastVisibleMs: 2200,
} as const;

export type PressPreset = 'soft' | 'strong';
