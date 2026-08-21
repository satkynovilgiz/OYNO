import avatarBek from '@assets/img/OYNO_design/avatar_bek.png';

import { mockGamesList } from '@/features/games/mockData';

import type { CultureTile, DailyChallenge, DailyGift, DailyProgress, PlayerSummary } from './types';

export const mockPlayer: PlayerSummary = {
  name: 'Бек',
  rank: 'Жаш оюнчу',
  level: 12,
  xpCurrent: 1250,
  xpMax: 2000,
  coins: 2450,
  gems: 180,
  avatarSource: avatarBek,
};

export const mockDailyChallenge: DailyChallenge = {
  description: 'Тогуз коргоол оюнун 1 жолу жеӊ',
  progressCurrent: 0,
  progressMax: 1,
  rewardXp: 100,
  rewardCoins: 50,
};

export const mockDailyGift: DailyGift = {
  subtitle: 'Эртен кайра кел!',
};

export const mockDailyProgress: DailyProgress = {
  description: 'Чүкө оюнун ойноп, 50 упай топто',
  progressCurrent: 25,
  progressMax: 50,
};

// Home's carousel is a preview: the first 5 games from the shared list
// (same order/content as the full Games hub), not a separate data source.
export const mockGames = mockGamesList.slice(0, 5);

export const mockCultureTiles: CultureTile[] = [
  { id: 'culture', title: 'Маданият', subtitle: 'Боз үй, оймо, шырдак', tone: 'culture' },
  { id: 'food', title: 'Ашкана', subtitle: 'Улуттук тамактар', tone: 'food' },
  { id: 'music', title: 'Музыка', subtitle: 'Комуз, ырлар, обондор', tone: 'music' },
  { id: 'map', title: 'Дүйнө картасы', subtitle: 'Аймактарды изилде', tone: 'map' },
];
