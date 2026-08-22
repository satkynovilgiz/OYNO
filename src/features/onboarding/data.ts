import type { ImageSourcePropType } from 'react-native';

import cultureHero from '@assets/img/OYNO_design/culture/culture_hero.png';
import mapTerrain from '@assets/img/OYNO_design/explore/map_terrain.png';
import heroBanner from '@assets/img/OYNO_design/hero_banner.png';
import toguzKorgoolThumb from '@assets/img/games/toguzKorgool/thumbnail.png';

export type OnboardingSlideId = 'welcome' | 'play' | 'explore' | 'culture';

export type OnboardingSlideImage = {
  id: OnboardingSlideId;
  image: ImageSourcePropType;
};

/** Images only - title/description are translated (i18n key
 * `onboarding.slides.{id}`), see OnboardingScreen. Images reuse existing
 * real art that already matches each slide's described visual, rather
 * than inventing new placeholder illustrations. */
export const onboardingSlideImages: OnboardingSlideImage[] = [
  { id: 'welcome', image: heroBanner },
  { id: 'play', image: toguzKorgoolThumb },
  { id: 'explore', image: mapTerrain },
  { id: 'culture', image: cultureHero },
];
