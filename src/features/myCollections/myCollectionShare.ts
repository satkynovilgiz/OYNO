import type { ImageSourcePropType } from 'react-native';

import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

/** Optional share (explicit action, with preview): the collection's name,
 * item count and OYNO branding. Never the private description, never
 * account data - those aren't even inputs. */
export function buildMyCollectionShareCard(input: { name: string; itemCountLabel: string; label: string; cover: ImageSourcePropType | null }): ShareCardContent {
  return { title: input.name, label: input.label, subtitle: input.itemCountLabel, imageSource: input.cover, fallbackTone: colors.surfaceFeature };
}
