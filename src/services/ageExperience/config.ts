import type { AgeExperience, ContentDepth } from './types';

/**
 * One configuration object per AgeExperience (Section "Create a central
 * configuration defining things such as... contentDensity, cardScale,
 * artworkProminence, textComplexity, characterProminence,
 * animationIntensity, learningDepth, challengeDifficulty,
 * navigationDensity"). Every field is a small closed enum, never a free
 * number/style object - screens translate these into their own existing
 * spacing/typography tokens (Section "Reuse shared components and
 * tokens"), so this file never grows into a second design system.
 */
export type AgeExperienceConfig = {
  /** How much is shown on one screen at once. */
  contentDensity: 'low' | 'medium' | 'high';
  /** Relative size of cards/touch targets vs. the shared design system's
   * own default sizing. */
  cardScale: 'large' | 'medium' | 'compact';
  /** How much visual weight artwork/photography gets vs. text/metadata. */
  artworkProminence: 'dominant' | 'high' | 'balanced';
  /** Copy length/vocabulary level for the same underlying message. */
  textComplexity: 'minimal' | 'simple' | 'standard' | 'rich';
  /** How often/prominently OYNO's guide characters (Section "Make OYNO
   * guide characters age-aware") appear and speak. */
  characterProminence: 'primary' | 'frequent' | 'occasional' | 'subtle';
  /** Motion/haptic intensity for shared entrance/press animations. */
  animationIntensity: 'playful' | 'moderate' | 'calm';
  /** Default content-depth (Section "Build age-aware content
   * presentation") when a screen doesn't pick one explicitly. */
  learningDepth: ContentDepth;
  /** Default difficulty steer for game presets/prompts. */
  challengeDifficulty: 'gentle' | 'balanced' | 'challenging';
  /** How much of the app's navigation surface (tabs, filters, secondary
   * actions) is exposed at once vs. deferred behind "see all"/detail
   * screens. */
  navigationDensity: 'minimal' | 'moderate' | 'full';
};

export const AGE_EXPERIENCE_CONFIG: Record<AgeExperience, AgeExperienceConfig> = {
  child: {
    contentDensity: 'low',
    cardScale: 'large',
    artworkProminence: 'dominant',
    textComplexity: 'minimal',
    characterProminence: 'primary',
    animationIntensity: 'playful',
    learningDepth: 'simple',
    challengeDifficulty: 'gentle',
    navigationDensity: 'minimal',
  },
  preteen: {
    contentDensity: 'medium',
    cardScale: 'medium',
    artworkProminence: 'high',
    textComplexity: 'simple',
    characterProminence: 'frequent',
    animationIntensity: 'playful',
    learningDepth: 'simple',
    challengeDifficulty: 'balanced',
    navigationDensity: 'moderate',
  },
  teen: {
    contentDensity: 'medium',
    cardScale: 'medium',
    artworkProminence: 'high',
    textComplexity: 'standard',
    characterProminence: 'occasional',
    animationIntensity: 'moderate',
    learningDepth: 'standard',
    challengeDifficulty: 'challenging',
    navigationDensity: 'full',
  },
  adult: {
    contentDensity: 'high',
    cardScale: 'compact',
    artworkProminence: 'balanced',
    textComplexity: 'rich',
    characterProminence: 'subtle',
    animationIntensity: 'calm',
    learningDepth: 'advanced',
    challengeDifficulty: 'balanced',
    navigationDensity: 'full',
  },
};
