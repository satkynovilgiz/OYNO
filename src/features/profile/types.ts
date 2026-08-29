import type { LucideIcon } from 'lucide-react-native';
import type { ImageSourcePropType } from 'react-native';

import type { CharacterId } from '@/components/character';
import type { AvatarConfig } from '@/services/avatar/avatarConfig';

export type ProfileSummary = {
  characterId: CharacterId;
  avatarConfig: AvatarConfig | null;
  name: string;
  level: number;
  title: string;
  xpCurrent: number;
  xpMax: number;
  coins: number;
  badges: number;
  tokens: number;
  streakDays: number;
};

export type ProfileStatId = 'games' | 'explore' | 'culture' | 'quests' | 'collection';

export type ProfileStat = {
  id: ProfileStatId;
  icon: LucideIcon;
  label: string;
  valueLabel: string;
  captionKey: 'count' | 'percent' | 'fraction';
  ringProgress: number; // 0..1, decorative for count-based stats
};

export type ProfileAchievement = {
  id: string;
  title: string;
  iconSource: ImageSourcePropType;
};

export type FavoriteGame = {
  id: string;
  name: string;
  thumbnail: ImageSourcePropType;
  gamesPlayed: number;
  wins: number;
  route?: string;
};

export type ProfileCollectionItem = {
  id: string;
  title: string;
  imageSource: ImageSourcePropType;
  current: number;
  total: number;
};

export type DailyActivityItem = {
  id: string;
  icon: LucideIcon;
  label: string;
};

export type DailyReward = {
  xp: number;
  coins: number;
};
