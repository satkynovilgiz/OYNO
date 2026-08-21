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

import type { ProfileAchievement, ProfileCollectionItem } from './types';

/**
 * Content catalog for the Profile screen (badge art, collection thumbnails)
 * - matches the design reference ("Kyrgyz Folk Profile Dashboard.png").
 * Real per-user numbers (xp, coins, unlocked achievements, favorite games,
 * daily activity) come from useProgressStore instead; see ProfileScreen.
 */
export const profileAchievements: ProfileAchievement[] = [
  { id: 'first-win', title: 'Биринчи жеңиш', iconSource: badgeFirstWin },
  { id: 'traveler', title: 'Саякатчы', iconSource: badgeTraveler },
  { id: 'boz-uy-guest', title: 'Боз үйдүн коногу', iconSource: badgeBozUyGuest },
  { id: 'komuzchu', title: 'Комузчу', iconSource: badgeKomuzchu },
];
/** Only these 4 have real, checkable unlock conditions (see
 * src/services/progress/achievements.ts); 50 is the eventual full catalog
 * size from the design spec, not yet built - see PROGRESS_AUDIT.md. */
export const achievementsTotal = 50;

export function getAchievement(id: string): ProfileAchievement | undefined {
  return profileAchievements.find((achievement) => achievement.id === id);
}

/** Per-item current/total counts are still a content-catalog mock - they
 * need the full discovery/lesson system to become real; see
 * PROGRESS_AUDIT.md. */
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
