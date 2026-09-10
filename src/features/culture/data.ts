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
import clothingBeldemchiChyptama from '@assets/img/OYNO_design/culture/clothing/beldemchi_chyptama.jpg';
import clothingChapanNooruz from '@assets/img/OYNO_design/culture/clothing/chapan_nooruz.png';
import clothingElechekCloseup from '@assets/img/OYNO_design/culture/clothing/elechek_closeup.jpg';
import clothingExhibitHallWide from '@assets/img/OYNO_design/culture/clothing/exhibit_hall_wide.jpg';
import clothingHeadwearPanel from '@assets/img/OYNO_design/culture/clothing/headwear_panel.jpg';
import clothingJewelryNecklaces from '@assets/img/OYNO_design/culture/clothing/jewelry_necklaces.jpg';
import clothingJewelryPendants from '@assets/img/OYNO_design/culture/clothing/jewelry_pendants.jpg';
import clothingJoolukKemsel from '@assets/img/OYNO_design/culture/clothing/jooluk_kemsel.jpg';
import clothingKalpakTebeteyCoat from '@assets/img/OYNO_design/culture/clothing/kalpak_tebetey_coat.jpg';
import clothingMensOuterwearCase from '@assets/img/OYNO_design/culture/clothing/mens_outerwear_case.jpg';
import clothingMensWomensCase from '@assets/img/OYNO_design/culture/clothing/mens_womens_case.jpg';
import clothingShokuloElechek from '@assets/img/OYNO_design/culture/clothing/shokulo_elechek.jpg';
import discoveryKomuz from '@assets/img/OYNO_design/culture/discovery_komuz.png';
import horseAtChabysh from '@assets/img/OYNO_design/culture/horse/at_chabysh_1870s.png';
import horseEer from '@assets/img/OYNO_design/culture/horse/eer_saddle.jpg';
import horseHorsemanSteppe from '@assets/img/OYNO_design/culture/horse/horseman_steppe.jpg';
import horseJylkyHerd from '@assets/img/OYNO_design/culture/horse/jylky_herd.jpg';
import horseKokBoruFlag from '@assets/img/OYNO_design/culture/horse/kok_boru_flag.jpg';
import horseKokBoruKazan from '@assets/img/OYNO_design/culture/horse/kok_boru_kazan.jpg';
import horseKyzKuumai from '@assets/img/OYNO_design/culture/horse/kyz_kuumai.jpg';
import horseOodarysh from '@assets/img/OYNO_design/culture/horse/oodarysh.jpg';
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
import shyrdakAlaKiyizMaking from '@assets/img/OYNO_design/culture/shyrdak/ala_kiyiz_making.jpg';
import shyrdakAlaKiyizMaking2 from '@assets/img/OYNO_design/culture/shyrdak/ala_kiyiz_making2.jpg';
import shyrdakColorsPattern from '@assets/img/OYNO_design/culture/shyrdak/colors_pattern.jpg';
import shyrdakInsideBozUy from '@assets/img/OYNO_design/culture/shyrdak/inside_boz_uy.jpg';
import shyrdakMosaicCloseup from '@assets/img/OYNO_design/culture/shyrdak/mosaic_closeup.jpg';
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
  'horse-overview': [horseHorsemanSteppe],
  'horse-jylky': [horseJylkyHerd],
  'horse-eer': [horseEer],
  'horse-kok-boru': [horseKokBoruFlag, horseKokBoruKazan],
  'horse-at-chabysh': [horseAtChabysh],
  'horse-kyz-kuumai': [horseKyzKuumai],
  'horse-oodarysh': [horseOodarysh],
  'shyrdak-craft': [shyrdakMosaicCloseup, shyrdakInsideBozUy],
  'shyrdak-ala-kiyiz': [shyrdakAlaKiyizMaking, shyrdakAlaKiyizMaking2],
  'shyrdak-tustor': [shyrdakColorsPattern],
  'clothing-ak-kalpak': [clothingKalpakTebeteyCoat],
  'clothing-tebetey': [clothingKalpakTebeteyCoat, clothingMensWomensCase],
  'clothing-topu': [clothingHeadwearPanel],
  'clothing-malakai': [clothingHeadwearPanel],
  'clothing-tumak': [clothingMensOuterwearCase],
  'clothing-takyya': [clothingHeadwearPanel],
  'clothing-shokulo': [clothingShokuloElechek],
  'clothing-elechek': [clothingElechekCloseup, clothingShokuloElechek],
  'clothing-jooluk': [clothingJoolukKemsel],
  'clothing-chapan': [clothingChapanNooruz, clothingMensWomensCase],
  'clothing-ton': [clothingMensOuterwearCase],
  'clothing-ichik': [clothingMensWomensCase],
  'clothing-beshmant': [clothingMensOuterwearCase],
  'clothing-kemsel': [clothingJoolukKemsel],
  'clothing-chyptama': [clothingBeldemchiChyptama],
  'clothing-chepken': [clothingExhibitHallWide],
  'clothing-beldemchi': [clothingBeldemchiChyptama],
  'clothing-solkobay': [clothingJewelryPendants],
  'clothing-boy-tumar': [clothingJewelryNecklaces],
  'clothing-ala-tamak': [clothingJewelryNecklaces],
  'clothing-soyko': [clothingJewelryNecklaces],
  'clothing-chachpak': [clothingElechekCloseup],
  'clothing-monchok': [clothingJewelryNecklaces],
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
