import type { ImageSourcePropType } from 'react-native';

import cultureHero from '@assets/img/OYNO_design/culture/culture_hero.png';
import mapTerrain from '@assets/img/OYNO_design/explore/map_terrain.png';
import heroBanner from '@assets/img/OYNO_design/hero_banner.png';
import toguzKorgoolThumb from '@assets/img/games/toguzKorgool/thumbnail.png';

export type OnboardingSlide = {
  id: string;
  image: ImageSourcePropType;
  title: string;
  description: string;
};

/**
 * Copy is verbatim from the spec (Section 12). Images reuse existing real
 * art that already matches each slide's described visual, rather than
 * inventing new placeholder illustrations.
 */
export const onboardingSlides: OnboardingSlide[] = [
  {
    id: 'welcome',
    image: heroBanner,
    title: 'Кыргыз дүйнөсү телефонуңда',
    description: 'Кыргыз маданиятын, оюндарын жана салтын жаңыча изилде.',
  },
  {
    id: 'play',
    image: toguzKorgoolThumb,
    title: 'Ойно',
    description: 'Кыргыздын улуттук оюндарын жаңы форматта тааны.',
  },
  {
    id: 'explore',
    image: mapTerrain,
    title: 'Изилде',
    description: 'Кыргызстандын аймактарын, жаратылышын жана мурасын ач.',
  },
  {
    id: 'culture',
    image: cultureHero,
    title: 'Маданиятты үйрөн',
    description: 'Боз үй, оймо, шырдак, комуз, ашкана жана каада-салттар менен тааныш.',
  },
];
