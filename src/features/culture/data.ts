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

import type { CultureCategory, CultureDiscovery, CultureMaterial, CultureProgress } from './types';

/**
 * Mock content for the Culture home screen, matching the numbers/titles
 * given in the design reference (docs: "OYNO Kyrgyz Culture App
 * Interface1.png") - not wired to real user progress or a content backend
 * yet. Category/material titles are kept in Kyrgyz (not run through
 * i18n) since most are proper nouns for specific cultural items (Комуз,
 * Шырдак, Оймо...) rather than UI chrome - same convention already used for
 * game names and Explore location names elsewhere in this app.
 */
export const cultureCategories: CultureCategory[] = [
  { id: 'boz-uy', title: 'Боз үй', current: 8, total: 12, imageSource: catBozUy },
  { id: 'oymo', title: 'Оймо', current: 10, total: 20, imageSource: catOymo },
  { id: 'shyrdak', title: 'Шырдак', current: 5, total: 10, imageSource: catShyrdak },
  { id: 'komuz', title: 'Комуз', current: 6, total: 10, imageSource: catKomuz },
  { id: 'music', title: 'Музыка', current: 7, total: 15, imageSource: catMusic },
  { id: 'clothing', title: 'Улуттук кийим', current: 6, total: 12, imageSource: catClothing },
  { id: 'horse', title: 'Ат маданияты', current: 8, total: 15, imageSource: catHorse },
  { id: 'food', title: 'Ашкана', current: 12, total: 20, imageSource: catFood },
  { id: 'games', title: 'Улуттук оюндар', current: 9, total: 15, imageSource: catGames },
  { id: 'tradition', title: 'Каада-салт', current: 8, total: 15, imageSource: catTradition },
];

export const cultureProgress: CultureProgress = {
  overallPercent: 47,
  stats: {
    'boz-uy': { current: 8, total: 12 },
    oymo: { current: 10, total: 20 },
    shyrdak: { current: 5, total: 10 },
    komuz: { current: 6, total: 10 },
    food: { current: 12, total: 20 },
    games: { current: 9, total: 15 },
  },
};

export const cultureTodayDiscovery: CultureDiscovery = {
  title: 'Комуз',
  description: 'Кыргыздын улуттук музыкалык аспабы жөнүндө жаңы нерсе үйрөн.',
  imageSource: discoveryKomuz,
  isNew: true,
};

export const cultureNewMaterials: CultureMaterial[] = [
  { id: 'kalpak-history', title: 'Калпактын тарыхы', type: 'reading', durationMinutes: 5, imageSource: materialKalpak },
  { id: 'boorsok-cooking', title: 'Боорсок жасоо', type: 'video', durationMinutes: 7, imageSource: materialBoorsok },
  { id: 'kyz-kuumai-game', title: 'Кыз куумай оюну', type: 'game', durationMinutes: 3, imageSource: materialKyzKuumai },
];
