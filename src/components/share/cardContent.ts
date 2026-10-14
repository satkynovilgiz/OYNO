import { colors } from '@/theme';

import type { ShareCardContent, ShareCardVariant } from './ShareCard';

/**
 * What each export card type may carry - its explicitly approved fields.
 * Applied ONCE when sharing starts (useShareCard), so the preview sheet and
 * the captured image get exactly the same, already-filtered content.
 * Anything else a caller passes (an id, a recipe, notes) never reaches a card.
 */
export const APPROVED_FIELDS: Record<ShareCardVariant, readonly (keyof ShareCardContent)[]> = {
  story: ['title', 'label', 'subtitle', 'imageSource', 'fallbackTone', 'completedLabel'],
  score: ['title', 'label', 'subtitle', 'imageSource', 'fallbackTone', 'stat'],
  // `excerpt` is the one line the person typed FOR the card - never filled from private text.
  journal: ['title', 'label', 'imageSource', 'excerpt', 'linkedLabel'],
  badge: ['title', 'label', 'imageSource', 'completedLabel'],
  creation: ['title', 'label', 'artwork', 'artworkSize', 'cardStyle'],
  summary: ['title', 'label', 'lines', 'featured', 'featuredLabel', 'cardStyle'],
  // A composed card (Oymo postcard, portfolio card): its own view is the whole card.
  postcard: ['title', 'label', 'artwork', 'cardSize'],
};

/** Text that must never be printed on a card even if a caller passed it: ids, emails, long numbers. */
const PRIVATE_TEXT = [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, /[^\s@]+@[^\s@]+\.[^\s@]+/, /\d{7,}/];
export const looksPrivate = (value: string) => PRIVATE_TEXT.some((pattern) => pattern.test(value));

export function approvedContent(content: ShareCardContent): ShareCardContent {
  const variant = content.variant ?? 'story';
  const out: Record<string, unknown> = { variant };
  for (const key of APPROVED_FIELDS[variant]) {
    const value = content[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      if (looksPrivate(value)) continue;
    } else if (Array.isArray(value)) {
      out[key] = value.filter((entry) => typeof entry !== 'string' || !looksPrivate(entry));
      continue;
    }
    out[key] = value;
  }
  // Required display fields stay strings (possibly empty), so a card never renders "undefined".
  out.title = typeof out.title === 'string' ? out.title : '';
  out.label = typeof out.label === 'string' ? out.label : '';
  if (!('imageSource' in out)) out.imageSource = null;
  return out as ShareCardContent;
}

/**
 * The small set of card styles (cream paper, forest, felt red) - the
 * OYNO palette only. Photo-led cards (story, score) keep their photograph;
 * the badge keeps forest; styles are offered where the artwork or text is
 * the subject (creation, summary).
 */
export type CardStyleId = 'paper' | 'forest' | 'felt';
export const CARD_STYLES: Record<CardStyleId, { background: string; frame: string; ink: string; inkSoft: string; label: string; wordmark: string; rule: string }> = {
  paper: { background: colors.surfaceElevated, frame: '#FFFDF7', ink: colors.textPrimary, inkSoft: colors.textSecondary, label: colors.accentTerracottaText, wordmark: colors.primary, rule: 'rgba(199,154,46,0.6)' },
  forest: { background: colors.surfaceFeature, frame: '#FFFDF7', ink: colors.textOnDark, inkSoft: colors.textOnDarkSecondary, label: colors.accentGold, wordmark: colors.textOnDark, rule: 'rgba(232,185,61,0.5)' },
  felt: { background: '#7A3226', frame: '#FBF3E3', ink: colors.textOnDark, inkSoft: 'rgba(251,243,227,0.86)', label: colors.accentGold, wordmark: colors.textOnDark, rule: 'rgba(232,185,61,0.55)' },
};
export const CARD_STYLE_IDS: CardStyleId[] = ['paper', 'forest', 'felt'];
export const STYLEABLE: readonly ShareCardVariant[] = ['creation', 'summary'];
export const defaultStyle = (variant: ShareCardVariant): CardStyleId => (variant === 'summary' ? 'forest' : 'paper');
