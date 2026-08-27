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

/** Structured so GameCard can render it through t() - a raw "1-2 оюнчу"
 * string (the old shape) couldn't respect a language switch, which is
 * exactly the Games-hub localization gap this type exists to fix. */
export type GamePlayers =
  | { kind: 'team' }
  | { kind: 'exact'; count: number }
  | { kind: 'open'; min: number };

export type GameDuration = { minMinutes: number; maxMinutes: number };

export type GameListItem = {
  id: string;
  name: string;
  thumbnail: ImageSourcePropType;
  category: GameCategory;
  difficulty: GameDifficulty;
  players: GamePlayers;
  duration: GameDuration;
  featured?: boolean;
  /** Route to push when "Ойноо" is pressed; omit for not-yet-built games. */
  route?: string;
};
