import type { ImageSourcePropType } from 'react-native';

export type GameCategory =
  | 'national'
  | 'horse'
  | 'skill'
  | 'logic'
  | 'team'
  | 'music'
  | 'cooking';

export type GameDifficulty = 'easy' | 'medium';

export type GameListItem = {
  id: string;
  name: string;
  thumbnail: ImageSourcePropType;
  category: GameCategory;
  difficulty: GameDifficulty;
  /** e.g. "1-2 оюнчу" content comes from mock data directly; this just says
   * whether to show a player-count string or the "Team" label. */
  players: string;
  duration: string;
  featured?: boolean;
  /** Route to push when "Ойноо" is pressed; omit for not-yet-built games. */
  route?: string;
};
