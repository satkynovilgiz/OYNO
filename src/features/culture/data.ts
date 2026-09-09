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
import bozUyTunduk from '@assets/img/OYNO_design/culture/boz_uy/tunduk_roof_crown.jpg';
import bozUyTushKiyiz from '@assets/img/OYNO_design/culture/boz_uy/tush_kiyiz_and_souvenirs.jpg';
import bozUyWallHanging from '@assets/img/OYNO_design/culture/boz_uy/wall_hanging_and_komuz.jpg';
import discoveryKomuz from '@assets/img/OYNO_design/culture/discovery_komuz.png';
import materialBoorsok from '@assets/img/OYNO_design/culture/material_boorsok.png';
import materialKalpak from '@assets/img/OYNO_design/culture/material_kalpak.png';
import materialKyzKuumai from '@assets/img/OYNO_design/culture/material_kyz_kuumai.png';
import oymoAdamdynJuzu from '@assets/img/OYNO_design/culture/oymo/adamdyn_juzu.jpg';
import oymoBalykOyuu from '@assets/img/OYNO_design/culture/oymo/balyk_oyuu.jpg';
import oymoBulak from '@assets/img/OYNO_design/culture/oymo/bulak.jpg';
import oymoItKuiruk from '@assets/img/OYNO_design/culture/oymo/it_kuiruk.jpg';
import oymoKazMoyun from '@assets/img/OYNO_design/culture/oymo/kaz_moyun.jpg';
import oymoKochkorMuyuz from '@assets/img/OYNO_design/culture/oymo/kochkor_muyuz.jpg';
import oymoMuyuzKyal from '@assets/img/OYNO_design/culture/oymo/muyuz_kyal.jpg';
import oymoTekeMuyuz from '@assets/img/OYNO_design/culture/oymo/teke_muyuz.jpg';
import oymoTortKulak from '@assets/img/OYNO_design/culture/oymo/tort_kulak.jpg';
import oymoUmaiEne from '@assets/img/OYNO_design/culture/oymo/umai_ene.jpg';
import oymoUmaiOyumu from '@assets/img/OYNO_design/culture/oymo/umai_oyumu.jpg';
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

/** Local image galleries for individual culture_items rows - RN's
 * require() needs a static literal path, so a DB-supplied image URL can
 * never resolve one (same constraint noted above for category/material
 * images); real photo uploads live here as a lookup map until Storage-
 * backed images exist (Phase 6g). */
export const cultureItemImages: Record<string, ImageSourcePropType[]> = {
  'boz-uy-overview': [bozUyTushKiyiz, bozUyTunduk, bozUyWallHanging],
  'oymo-umai-ene': [oymoUmaiEne],
  'oymo-balyk-oyuu': [oymoBalykOyuu],
  'oymo-it-kuiruk': [oymoItKuiruk],
  'oymo-kochkor-muyuz': [oymoKochkorMuyuz],
  'oymo-teke-muyuz': [oymoTekeMuyuz],
  'oymo-kaz-moyun': [oymoKazMoyun],
  'oymo-bulak': [oymoBulak],
  'oymo-umai-oyumu': [oymoUmaiOyumu],
  'oymo-adamdyn-juzu': [oymoAdamdynJuzu],
  'oymo-muyuz-kyal': [oymoMuyuzKyal],
  'oymo-tort-kulak': [oymoTortKulak],
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
