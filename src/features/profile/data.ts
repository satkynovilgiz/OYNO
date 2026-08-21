import { Backpack, Compass, Diamond, Gamepad2, Target } from 'lucide-react-native';

import catBozUy from '@assets/img/OYNO_design/culture/cat_boz_uy.png';
import catHorse from '@assets/img/OYNO_design/culture/cat_horse.png';
import catKomuz from '@assets/img/OYNO_design/culture/cat_komuz.png';
import catOymo from '@assets/img/OYNO_design/culture/cat_oymo.png';
import catShyrdak from '@assets/img/OYNO_design/culture/cat_shyrdak.png';
import badgeBozUyGuest from '@assets/img/OYNO_design/profile/badge_boz_uy_guest.png';
import badgeFirstWin from '@assets/img/OYNO_design/profile/badge_first_win.png';
import badgeKomuzchu from '@assets/img/OYNO_design/profile/badge_komuzchu.png';
import badgeTraveler from '@assets/img/OYNO_design/profile/badge_traveler.png';
import collectionAnimals from '@assets/img/OYNO_design/profile/collection_animals.png';

import { mockGamesList } from '@/features/games/mockData';

import type {
  DailyActivityItem,
  DailyReward,
  FavoriteGame,
  ProfileAchievement,
  ProfileCollectionItem,
  ProfileStat,
  ProfileSummary,
} from './types';

/**
 * Mock content for the Profile home screen, matching the numbers/titles
 * given in the design reference (docs: "Kyrgyz Folk Profile
 * Dashboard.png") - not wired to a real account/backend yet. Favorite
 * games reuse the real thumbnails already shipped for the Games hub;
 * collection thumbnails reuse the ones already sliced for Culture where
 * the same item appears there too.
 */
export const mockProfile: ProfileSummary = {
  characterId: 'bek',
  name: 'Бек',
  level: 12,
  title: 'Кыргыз маданиятын изилдөөчү',
  xpCurrent: 1250,
  xpMax: 2000,
  coins: 2450,
  badges: 18,
  tokens: 120,
  streakDays: 7,
};

export const profileStats: ProfileStat[] = [
  { id: 'games', icon: Gamepad2, label: 'Оюндар', valueLabel: '42', captionKey: 'count', ringProgress: 0.6 },
  { id: 'explore', icon: Compass, label: 'Изилдөө', valueLabel: '37%', captionKey: 'percent', ringProgress: 0.37 },
  { id: 'culture', icon: Diamond, label: 'Маданият', valueLabel: '47%', captionKey: 'percent', ringProgress: 0.47 },
  { id: 'quests', icon: Target, label: 'Квесттер', valueLabel: '28', captionKey: 'count', ringProgress: 0.5 },
  { id: 'collection', icon: Backpack, label: 'Коллекция', valueLabel: '64 / 150', captionKey: 'fraction', ringProgress: 64 / 150 },
];

export const profileAchievements: ProfileAchievement[] = [
  { id: 'first-win', title: 'Биринчи жеңиш', iconSource: badgeFirstWin },
  { id: 'traveler', title: 'Саякатчы', iconSource: badgeTraveler },
  { id: 'boz-uy-guest', title: 'Боз үйдүн коногу', iconSource: badgeBozUyGuest },
  { id: 'komuzchu', title: 'Комузчу', iconSource: badgeKomuzchu },
];
export const achievementsUnlocked = 18;
export const achievementsTotal = 50;

const favoriteGameStats: Record<string, { gamesPlayed: number; wins: number }> = {
  'toguz-korgool': { gamesPlayed: 23, wins: 16 },
  chuko: { gamesPlayed: 18, wins: 12 },
  ordo: { gamesPlayed: 14, wins: 9 },
};

export const favoriteGames: FavoriteGame[] = mockGamesList
  .filter((game) => game.id in favoriteGameStats)
  .map((game) => ({
    id: game.id,
    name: game.name,
    thumbnail: game.thumbnail,
    ...favoriteGameStats[game.id],
  }));

export const profileCollection: ProfileCollectionItem[] = [
  { id: 'komuz', title: 'Комуз', imageSource: catKomuz, current: 3, total: 5 },
  { id: 'boz-uy-items', title: 'Боз үй буюмдары', imageSource: catBozUy, current: 7, total: 12 },
  { id: 'oymo', title: 'Оймо', imageSource: catOymo, current: 10, total: 20 },
  { id: 'shyrdak', title: 'Шырдак', imageSource: catShyrdak, current: 5, total: 10 },
  { id: 'horse-culture', title: 'Ат маданияты', imageSource: catHorse, current: 6, total: 15 },
  { id: 'animals', title: 'Жаныбарлар', imageSource: collectionAnimals, current: 8, total: 20 },
];
export const collectionUnlocked = 64;
export const collectionTotal = 150;

export const dailyActivity: DailyActivityItem[] = [
  { id: 'games', icon: Gamepad2, label: '2 оюн ойнолду' },
  { id: 'discovery', icon: Compass, label: '1 жаңы ачылыш' },
  { id: 'lesson', icon: Diamond, label: '1 маданий сабак' },
  { id: 'quests', icon: Target, label: '2 квест аткарылды' },
];
export const dailyActivityCompleted = 4;
export const dailyActivityTotal = 5;

export const dailyReward: DailyReward = { xp: 100, coins: 50 };
