import type { AgeExperienceConfig } from '@/services/ageExperience/config';

type AnimationIntensity = AgeExperienceConfig['animationIntensity'];

/**
 * Concrete numeric values per `AgeExperienceConfig.animationIntensity`
 * (spec "Create a restrained OYNO motion system... Child mode can have
 * slightly stronger playful motion. Teen/adult should use restrained
 * premium motion") - the one place that field turns into real animation
 * parameters, so "child gets livelier motion, adult gets calmer motion"
 * is expressed once and reused everywhere instead of every screen
 * re-deriving its own numbers.
 */
export const MOTION_BY_INTENSITY: Record<
  AnimationIntensity,
  {
    /** Card press scale-down - lower = a more noticeable "squish". */
    pressScale: number;
    /** Entrance fade/slide distance in pixels and duration in ms. */
    enterDistance: number;
    enterDurationMs: number;
    /** Spring config for press feedback bounce-back. */
    spring: { damping: number; stiffness: number };
  }
> = {
  playful: { pressScale: 0.94, enterDistance: 14, enterDurationMs: 260, spring: { damping: 14, stiffness: 260 } },
  moderate: { pressScale: 0.96, enterDistance: 10, enterDurationMs: 220, spring: { damping: 16, stiffness: 300 } },
  calm: { pressScale: 0.98, enterDistance: 6, enterDurationMs: 180, spring: { damping: 18, stiffness: 340 } },
};

/**
 * Screen-level entrance motion - `ScreenEntrance`/`HeroEntrance` use this
 * instead of `MOTION_BY_INTENSITY` directly. A page's header/hero is a
 * single, once-per-mount moment (not a repeated per-card pop), so it reads
 * better a touch slower and steadier than a card's entrance - still inside
 * the "roughly 250-450ms" restrained-premium window the whole tier ladder
 * stays in, never bouncy or slow enough to make tab-switching feel laggy.
 */
export const SCREEN_MOTION_BY_INTENSITY: Record<
  AnimationIntensity,
  { enterDistance: number; enterDurationMs: number }
> = {
  playful: { enterDistance: 14, enterDurationMs: 380 },
  moderate: { enterDistance: 10, enterDurationMs: 340 },
  calm: { enterDistance: 8, enterDurationMs: 300 },
};
