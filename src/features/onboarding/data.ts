import type { ImageSourcePropType } from 'react-native';

import journeyImage from '@assets/img/welcome/Kyrgyz Golden Hour Journey.png';
import cultureImage from '@assets/img/welcome/Golden Hour Music in a Kyrgyz Yurt.png';
import playImage from '@assets/img/welcome/Golden Hour Buzkashi in the Mountains.png';
import welcomeImage from '@assets/img/welcome/Golden Hour at a Kyrgyz Mountain Lake.png';

export type OnboardingSlideId = 'welcome' | 'culture' | 'play' | 'journey';

export type OnboardingSlideImage = {
  id: OnboardingSlideId;
  image: ImageSourcePropType;
};

/** Images only - title/description are translated (i18n key
 * `onboarding.slides.{id}`), see OnboardingScreen. Four commissioned
 * vertical photographs (background/hero art only, no baked-in text or
 * UI), replacing the earlier onboarding sequence which reused thumbnails
 * from other screens (Home's hero banner, a game thumbnail, the Explore
 * map, Culture's hero) that were never actually made for this full-bleed
 * portrait context. */
export const onboardingSlideImages: OnboardingSlideImage[] = [
  { id: 'welcome', image: welcomeImage },
  { id: 'culture', image: cultureImage },
  { id: 'play', image: playImage },
  { id: 'journey', image: journeyImage },
];
