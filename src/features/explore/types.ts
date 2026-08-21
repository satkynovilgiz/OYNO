import type { ImageSourcePropType } from 'react-native';

import type { CharacterId } from '@/components/character';

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

export type MapPinVariant = 'default' | 'landmark';

/** A pin placed on the KyrgyzstanMap, referencing an ExploreLocation by id.
 * Position is percent-based (0-100) so it scales with the map card and
 * survives the pinch-zoom/pan transform without extra layout math. */
export type ExploreMapPin = {
  locationId: string;
  xPercent: number;
  yPercent: number;
  color: string;
  variant: MapPinVariant;
};

export type ExploreStatId = 'locations' | 'nature' | 'culture' | 'animals' | 'food' | 'quests';

export type ExploreProgress = {
  overallPercent: number;
  stats: Record<ExploreStatId, { current: number; total: number }>;
};

export type ExploreDiscoveryCategory = 'nature' | 'culture' | 'animals' | 'food';

export type ExploreDiscovery = {
  id: string;
  title: string;
  category: ExploreDiscoveryCategory;
  xpReward: number;
  imageSource?: ImageSourcePropType;
};

export type ExploreQuest = {
  id: string;
  characterId: CharacterId;
  title: string;
  subtitle: string;
  foundCount: number;
  totalCount: number;
  ctaLabel: string;
};
