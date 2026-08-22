import catBozUy from '@assets/img/OYNO_design/culture/cat_boz_uy.png';
import catClothing from '@assets/img/OYNO_design/culture/cat_clothing.png';
import catFood from '@assets/img/OYNO_design/culture/cat_food.png';
import catGames from '@assets/img/OYNO_design/culture/cat_games.png';
import catHorse from '@assets/img/OYNO_design/culture/cat_horse.png';
import catKomuz from '@assets/img/OYNO_design/culture/cat_komuz.png';
import catMusic from '@assets/img/OYNO_design/culture/cat_music.png';
import catOymo from '@assets/img/OYNO_design/culture/cat_oymo.png';
import catShyrdak from '@assets/img/OYNO_design/culture/cat_shyrdak.png';
import catTradition from '@assets/img/OYNO_design/culture/cat_tradition.png';
import discoveryKomuz from '@assets/img/OYNO_design/culture/discovery_komuz.png';
import materialBoorsok from '@assets/img/OYNO_design/culture/material_boorsok.png';
import materialKalpak from '@assets/img/OYNO_design/culture/material_kalpak.png';
import materialKyzKuumai from '@assets/img/OYNO_design/culture/material_kyz_kuumai.png';
import type { ImageSourcePropType } from 'react-native';

import type { CultureCategoryId, CultureProgress, CultureStatId } from './types';

/**
 * Category/material content itself (id, title, description) is now
 * server-driven (Phase 6c, see src/services/content/cultureService.ts) -
 * this file only keeps what genuinely can't live in the database: bundled
 * local image assets (RN `require()` needs a static literal path, so a
 * DB-supplied string can never resolve one - real Storage-backed images are
 * Phase 6g) and the still-mock progress numbers below, which were never
 * wired to a real collection-items count and stay exactly as fake as they
 * were before this migration - not real per-user data, just a placeholder
 * for a system that doesn't exist yet.
 */
export const cultureCategoryImages: Record<CultureCategoryId, ImageSourcePropType> = {
  'boz-uy': catBozUy,
  oymo: catOymo,
  shyrdak: catShyrdak,
  komuz: catKomuz,
  music: catMusic,
  clothing: catClothing,
  horse: catHorse,
  food: catFood,
  games: catGames,
  tradition: catTradition,
};

/** Mock per-category progress - not wired to a real collection-items count. */
export const cultureCategoryMockProgress: Record<CultureCategoryId, { current: number; total: number }> = {
  'boz-uy': { current: 8, total: 12 },
  oymo: { current: 10, total: 20 },
  shyrdak: { current: 5, total: 10 },
  komuz: { current: 6, total: 10 },
  music: { current: 7, total: 15 },
  clothing: { current: 6, total: 12 },
  horse: { current: 8, total: 15 },
  food: { current: 12, total: 20 },
  games: { current: 9, total: 15 },
  tradition: { current: 8, total: 15 },
};

export const cultureMaterialImages: Record<string, ImageSourcePropType> = {
  'komuz-discovery': discoveryKomuz,
  'kalpak-history': materialKalpak,
  'boorsok-cooking': materialBoorsok,
  'kyz-kuumai-game': materialKyzKuumai,
};

/** Mock overview progress - not wired to real user progress yet. */
export const cultureProgress: CultureProgress = {
  overallPercent: 47,
  stats: Object.fromEntries(
    (['boz-uy', 'oymo', 'shyrdak', 'komuz', 'food', 'games'] as CultureStatId[]).map((id) => [
      id,
      cultureCategoryMockProgress[id],
    ]),
  ) as Record<CultureStatId, { current: number; total: number }>,
};
