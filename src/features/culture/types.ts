import type { ImageSourcePropType } from 'react-native';

/**
 * The 10 categories shown in the "Маданият категориялары" grid. `music` and
 * `games` are distinct from `komuz`/`tradition` per the design reference,
 * matching the spec's category list.
 */
export type CultureCategoryId =
  | 'boz-uy'
  | 'oymo'
  | 'shyrdak'
  | 'komuz'
  | 'music'
  | 'clothing'
  | 'horse'
  | 'food'
  | 'games'
  | 'tradition';

export type CultureCategory = {
  id: CultureCategoryId;
  title: string;
  current: number;
  total: number;
  imageSource: ImageSourcePropType;
};

/** Subset of categories surfaced in the CultureProgressCard stat row,
 * matching the design reference (not all 10 categories appear there). */
export type CultureStatId = 'boz-uy' | 'oymo' | 'shyrdak' | 'komuz' | 'food' | 'games';

export type CultureProgress = {
  overallPercent: number;
  stats: Record<CultureStatId, { current: number; total: number }>;
};

export type CultureDiscovery = {
  title: string;
  description: string;
  imageSource: ImageSourcePropType;
  isNew: boolean;
};

export type CultureMaterialType = 'reading' | 'video' | 'game';

export type CultureMaterial = {
  id: string;
  title: string;
  type: CultureMaterialType;
  durationMinutes: number;
  imageSource: ImageSourcePropType;
};
