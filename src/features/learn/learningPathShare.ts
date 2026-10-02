import type { ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

/** Completed path card: title, "Path completed", hero/tone, OYNO - nothing
 * about the person. */
export function buildPathShareCard(input: { title: string; completedLabel: string; hero: ImageSourcePropType | null }): ShareCardContent {
  return { title: input.title, label: input.completedLabel, imageSource: input.hero, fallbackTone: colors.primary, completedLabel: input.completedLabel };
}
