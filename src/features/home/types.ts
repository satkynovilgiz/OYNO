import type { ImageSourcePropType } from 'react-native';

export type PlayerSummary = {
  name: string;
  rank: string;
  level: number;
  xpCurrent: number;
  xpMax: number;
  coins: number;
  gems: number;
  avatarSource?: ImageSourcePropType;
};

export type DailyChallenge = {
  description: string;
  progressCurrent: number;
  progressMax: number;
  rewardXp: number;
  rewardCoins: number;
};

export type DailyGift = {
  subtitle: string;
};

export type DailyProgress = {
  description: string;
  progressCurrent: number;
  progressMax: number;
};

export type CultureTileTone = 'culture' | 'food' | 'music' | 'map';

export type CultureTile = {
  id: string;
  title: string;
  subtitle: string;
  tone: CultureTileTone;
  imageUri?: string;
};
