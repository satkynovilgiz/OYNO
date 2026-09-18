import type { AgeExperienceConfig } from './config';

type GradientStops = { colors: [string, string]; locations: [number, number] };

/**
 * Bottom-gradient overlay per artworkProminence, shared by every
 * full-bleed-artwork card (GameCard, EditorialCard) so the same age reads
 * the same way everywhere: 'dominant' (child) stays soft and warm,
 * 'cinematic' (teen) goes darker/taller for a more dramatic, less-childish
 * look, 'balanced' (adult) stays subtle so more of the photo itself shows
 * through (editorial, not gamified).
 */
export const GRADIENT_BY_ARTWORK_PROMINENCE: Record<AgeExperienceConfig['artworkProminence'], GradientStops> = {
  dominant: { colors: ['rgba(19,32,24,0)', 'rgba(19,32,24,0.88)'], locations: [0.4, 1] },
  high: { colors: ['rgba(19,32,24,0)', 'rgba(19,32,24,0.9)'], locations: [0.35, 1] },
  cinematic: { colors: ['rgba(10,16,12,0.05)', 'rgba(10,16,12,0.96)'], locations: [0.15, 1] },
  balanced: { colors: ['rgba(19,32,24,0)', 'rgba(19,32,24,0.78)'], locations: [0.55, 1] },
};
