import type { ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';

const MAX_SUBTITLE = 90;

/**
 * The share card for an Explore destination: its real photo (or its tone
 * when there is none - never a black card), its name in the app language,
 * a short tagline ONLY when that tagline is genuinely in the app language,
 * and the place-type label. Public content only: no account, visit date,
 * journal text or internal id.
 */
export function buildPlaceShareCard(input: {
  name: string;
  kindLabel: string;
  tagline: string | null | undefined;
  taglineInAppLanguage: boolean;
  imageSource: ImageSourcePropType | null | undefined;
  fallbackTone: string;
}): ShareCardContent {
  const tagline = input.taglineInAppLanguage ? input.tagline?.replace(/\s+/g, ' ').trim() : '';
  return {
    title: input.name,
    label: input.kindLabel,
    subtitle: tagline ? (tagline.length > MAX_SUBTITLE ? `${tagline.slice(0, MAX_SUBTITLE - 1).trimEnd()}…` : tagline) : null,
    imageSource: input.imageSource ?? null,
    fallbackTone: input.fallbackTone,
  };
}
