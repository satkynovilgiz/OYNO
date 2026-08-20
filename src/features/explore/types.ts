export type ExploreLocationKind = 'region' | 'nature';

export type VerificationStatus = 'verified' | 'partially_verified' | 'unverified';

export type LocalizedText = {
  kg: string;
  ru: string;
  en: string;
};

export type ExploreLocation = {
  id: string;
  kind: ExploreLocationKind;
  name: LocalizedText;
  /** Short kg subtitle for the location card/header. */
  tagline: string;
  /** Sourced, kg-language facts. See content/explore/{id}.md for citations. */
  facts: string[];
  status: VerificationStatus;
  /** Mock discovery progress (0-100) - not wired to real user progress yet. */
  discoveredPercent: number;
  locked?: boolean;
  unlockRequirement?: string;
};

export type ExploreCategoryId =
  | 'nature'
  | 'games'
  | 'food'
  | 'music'
  | 'culture'
  | 'history'
  | 'crafts'
  | 'animals'
  | 'quests';
