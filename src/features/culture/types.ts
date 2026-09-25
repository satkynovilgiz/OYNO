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
