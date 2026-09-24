import { useAgeExperience } from '@/services/ageExperience/useAgeExperience';
import { colors } from '@/theme';

/**
 * The one visual language for in-game chrome (HUD, pause, tutorial, result
 * accents): translucent deep-forest surfaces, cream text, restrained gold -
 * so every 3D game's UI reads as OYNO, and the centre of the screen stays
 * clear for the game itself.
 */
export const HUD = {
  surface: 'rgba(19,32,24,0.74)',
  surfaceStrong: 'rgba(19,32,24,0.92)',
  border: 'rgba(232,185,61,0.32)',
  text: colors.textOnDark,
  textMuted: 'rgba(251,243,227,0.7)',
  gold: colors.accentGold,
  scrim: 'rgba(12,20,15,0.62)',
} as const;

export type HudScale = {
  /** Square touch size of HUD buttons (pause). Never below 44. */
  button: number;
  /** Font size of HUD numbers. */
  value: number;
  /** Title chip visible (the teen/adult HUD is the most minimal). */
  showTitle: boolean;
  /** Oymo accents (the adult HUD is the least decorative). */
  ornament: boolean;
};

/**
 * Age adaptation of the same HUD: children get bigger controls and
 * numbers; preteens the full "game feedback" set; teens a minimal HUD;
 * adults the cleanest, least decorative one.
 */
export function useHudScale(): HudScale {
  const { experience } = useAgeExperience();
  switch (experience) {
    case 'child':
      return { button: 52, value: 19, showTitle: true, ornament: true };
    case 'preteen':
      return { button: 46, value: 17, showTitle: true, ornament: true };
    case 'teen':
      return { button: 44, value: 16, showTitle: false, ornament: false };
    default:
      return { button: 44, value: 15, showTitle: true, ornament: false };
  }
}
