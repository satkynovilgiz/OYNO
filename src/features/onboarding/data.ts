import type { ImageSourcePropType } from 'react-native';

import journeyImage from '@assets/img/welcome/Kyrgyz Golden Hour Journey.jpg';
import cultureImage from '@assets/img/welcome/Golden Hour Music in a Kyrgyz Yurt.jpg';
import playImage from '@assets/img/welcome/Golden Hour Buzkashi in the Mountains.jpg';
import welcomeImage from '@assets/img/welcome/Golden Hour at a Kyrgyz Mountain Lake.jpg';

/** The opening (language) screen's full-bleed photograph. */
export const openingImage: ImageSourcePropType = welcomeImage;

export type OnboardingSlideId = 'discover' | 'play' | 'journey';

export type OnboardingSlideImage = {
  id: OnboardingSlideId;
  /** Atmospheric backdrop behind the slide's real-content collage. */
  image: ImageSourcePropType;
};

/** Three story slides (copy: `onboarding.v2.{id}`). The welcome moment now
 * lives on the opening/language screen, so first-run is 5 screens total:
 * opening + language -> discover -> play & learn -> your journey -> age. */
export const onboardingSlideImages: OnboardingSlideImage[] = [
  { id: 'discover', image: journeyImage },
  { id: 'play', image: playImage },
  { id: 'journey', image: cultureImage },
];
