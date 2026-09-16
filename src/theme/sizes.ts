/**
 * Shared sizing scale so icon/touch-target/media dimensions stop being
 * re-invented as random pixel values per screen (Section "Create/reuse
 * shared spacing and sizing tokens instead of random pixel values").
 * Avatar sizing already has its own named scale - see
 * `UserAvatarSize`/`SIZE_PX` in src/components/avatar/UserAvatar.tsx -
 * this file does not duplicate that.
 */

/** Icon (glyph) pixel sizes, by role - not container sizes. */
export const iconSizes = {
  /** Inline metadata/caption icons (small text-row bullets). */
  xs: 14,
  /** Default row/list icon, "see all" chevrons, filter icons. */
  sm: 16,
  /** Default icon-in-chip glyph, header action icons. */
  md: 20,
  /** Bottom-nav / primary header icons. */
  lg: 24,
  /** Empty-state / feature icons. */
  xl: 28,
} as const;

/** Round/rounded-square icon container sizes (see IconChip/IconButton). */
export const iconContainerSizes = {
  /** Compact list-row leading icon. */
  sm: 36,
  /** Default card/header icon chip. */
  md: 44,
  /** Empty-state icon chip. */
  lg: 56,
} as const;

/** Minimum comfortable mobile tap target (Apple HIG / Material both use 44-48pt). */
export const minTouchTarget = 44;

/** Shared image aspect ratios (width / height) so the same media role reads
 * the same everywhere instead of every card cropping art differently. */
export const aspectRatios = {
  /** Square thumbnails (game tiles, collection items). */
  square: 1,
  /** Standard content card artwork (Culture/Explore cards). */
  card: 4 / 3,
  /** Wide banner/hero artwork. */
  banner: 16 / 9,
  /** Full-bleed onboarding/hero slide artwork. */
  hero: 4 / 5,
} as const;
