import avatarBek from '@assets/img/avatar_bek.png';

import type { CultureTile, DailyChallenge, DailyGift, GameSummary, PlayerSummary } from './types';

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

export const mockHasUnreadNotifications = true;

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

export const mockGames: GameSummary[] = [
  { id: 'toguz-korgool', name: 'Тогуз коргоол' },
  { id: 'chuko', name: 'Чүкө' },
  { id: 'ordo', name: 'Ордо' },
  { id: 'besh-tash', name: 'Беш таш' },
  { id: 'arkan-tartysh', name: 'Аркан тартыш' },
];

export const mockCultureTiles: CultureTile[] = [
  { id: 'culture', title: 'Маданият', subtitle: 'Боз үй, оймо, шырдак', tone: 'culture' },
  { id: 'food', title: 'Ашкана', subtitle: 'Улуттук тамактар', tone: 'food' },
  { id: 'music', title: 'Музыка', subtitle: 'Комуз, ырлар, обондор', tone: 'music' },
  { id: 'map', title: 'Дүйнө картасы', subtitle: 'Аймактарды изилде', tone: 'map' },
];
