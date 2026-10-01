import type { ShareCardContent } from '@/components/share/ShareCard';
import { colors } from '@/theme';

import { gameArt } from '../gamesCatalog';

/**
 * Personal-best share card: game artwork, localized game name, the result
 * and "Personal Best", OYNO branding (the card itself). Nothing about the
 * person - no name, email, id or diagnostics.
 */
export function buildPersonalBestShareCard(input: { gameName: string; valueText: string; personalBestLabel: string; listId: string }): ShareCardContent {
  return {
    title: input.gameName,
    label: input.personalBestLabel,
    subtitle: input.valueText,
    imageSource: gameArt({ id: input.listId }, 'large'),
    fallbackTone: colors.primary,
  };
}

