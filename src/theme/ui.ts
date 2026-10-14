import { colors } from './colors';
import { cardRadii, radii } from './radii';
import { spacing } from './spacing';
import { textStyles } from './typography';

/**
 * Semantic UI conventions (docs/UI_CONVENTIONS.md) - named roles over the
 * existing tokens, so screens stop re-deciding sizes. Nothing here adds a
 * new colour or size; every value is an existing token.
 */

/** Heading hierarchy: one screen title, then sections, then cards. */
export const headings = {
  /** Onboarding / one hero moment only. */
  display: textStyles.display,
  /** The screen's own title (one per screen, accessibilityRole="header"). */
  screen: textStyles.h2,
  /** A section inside a screen. */
  section: textStyles.h3,
  /** A card or list-item title. */
  card: textStyles.title,
  /** Small uppercase label above a group or inside a card (not a heading level of its own). */
  label: textStyles.overline,
} as const;

/** Text roles under the headings. */
export const text = {
  body: textStyles.body,
  emphasis: textStyles.bodyMedium,
  meta: textStyles.caption,
  fine: textStyles.small,
  /** Long-form article paragraphs (reader settings scale this further). */
  reading: { ...textStyles.body, fontSize: 16, lineHeight: 25 },
  readingLarge: { ...textStyles.body, fontSize: 17, lineHeight: 26 },
} as const;

/** Layout rhythm. */
export const layout = {
  /** Horizontal screen gutter. */
  gutter: spacing.md,
  /** Between top-level sections of a screen. */
  sectionGap: spacing.xl,
  /** Between items in a section (cards in a list, a title and its content). */
  stackGap: spacing.sm,
  /** Inside a card, between its lines. */
  cardGap: spacing.xs,
  /** Reading / form content never grows wider than this on tablets and wide windows. */
  maxContentWidth: 720,
  /** Lists and grids of cards (Home, Shelf, record lists). */
  maxListWidth: 960,
  /** Tool workspaces (Creator: canvas + tools side by side). */
  maxWorkspaceWidth: 1200,
} as const;

/** Centre a column and stop it stretching across a tablet or wide window (phones are narrower, so unchanged). */
export const bounded = (maxWidth: number) => ({ width: '100%' as const, maxWidth, alignSelf: 'center' as const });

/** Card padding + radius pairs - the only three card shapes. */
export const cardPadding = { compact: spacing.sm, standard: spacing.md, feature: spacing.lg } as const;

const cardBase = { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle } as const;
export const cards = {
  /** Default content card (lists, settings rows, editors). */
  standard: { ...cardBase, padding: cardPadding.standard, borderRadius: cardRadii.compact, gap: layout.cardGap },
  /** Dense rows inside a card or a tight list. */
  compact: { ...cardBase, padding: cardPadding.compact, borderRadius: cardRadii.compact, gap: spacing.xxs },
  /** The one highlighted card on a screen (current step, Continue, offer). */
  highlighted: { ...cardBase, padding: cardPadding.standard, borderRadius: cardRadii.compact, gap: layout.cardGap, borderColor: colors.primary },
  /** Large media / feature block. */
  feature: { ...cardBase, padding: cardPadding.feature, borderRadius: cardRadii.media, gap: layout.stackGap },
  /** Informational note: no border, muted surface. */
  note: { padding: cardPadding.compact, borderRadius: cardRadii.compact, backgroundColor: colors.surfaceMuted },
} as const;

/**
 * Interaction states, one table for every control. Pressed and disabled
 * are explicit colours (not just opacity), so they stay readable and
 * distinct on every surface.
 */
export type ControlTone = 'primary' | 'accent' | 'secondary' | 'ghost' | 'text' | 'destructive';
type ToneStates = { bg: string; fg: string; border?: string; pressedBg: string };
export const controlStates: Record<ControlTone, ToneStates> & { disabled: { bg: string; fg: string; border: string }; disabledText: { fg: string }; selected: { bg: string; fg: string; border: string }; focusRing: string } = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary, pressedBg: colors.primaryPressed },
  accent: { bg: colors.accentGold, fg: colors.textPrimary, pressedBg: colors.accentGoldPressed },
  secondary: { bg: colors.surfaceElevated, fg: colors.primary, border: colors.borderSubtle, pressedBg: colors.surfaceMuted },
  ghost: { bg: 'transparent', fg: colors.primary, border: colors.border, pressedBg: colors.surfaceMuted },
  text: { bg: 'transparent', fg: colors.primary, pressedBg: colors.surfaceMuted },
  destructive: { bg: colors.dangerFill, fg: colors.textOnPrimary, pressedBg: colors.accentTerracottaDark },
  /** Any filled/outlined control that can't be used right now. */
  disabled: { bg: colors.surfaceMuted, fg: colors.textMuted, border: colors.borderSubtle },
  /** A text-only control that can't be used right now. */
  disabledText: { fg: colors.textMuted },
  /** A chosen chip / segment / radio. */
  selected: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary },
  focusRing: colors.accentGoldText,
};

/** Overlays over photography/artwork - the repeated rgba values, named. */
export const overlays = {
  clear: colors.scrimClear,
  soft: 'rgba(19,32,24,0.35)',
  medium: 'rgba(19,32,24,0.45)',
  half: 'rgba(19,32,24,0.5)',
  chip: colors.chipOnDark,
  strong: 'rgba(19,32,24,0.8)',
  scrim: colors.scrimBottom,
  goldGlow: 'rgba(232,185,61,0.35)',
} as const;

/** Round medallion behind an icon. */
export const medallion = (size: number) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center' as const, justifyContent: 'center' as const });
export const pill = radii.pill;
