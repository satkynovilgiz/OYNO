import type { ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

/** Then & Now share card: the item's image, its title and "Then & Now" -
 * never a paragraph of the article. */
export function buildThenNowShareCard(input: { title: string; label: string; image: ImageSourcePropType | null }): ShareCardContent {
  return { title: input.title, label: input.label, imageSource: input.image, fallbackTone: colors.accentTerracotta };
}
