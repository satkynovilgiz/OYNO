import type { ContentDepth } from './types';

/**
 * Resolves which stored content variant to show for a given depth (spec
 * "Build age-aware content presentation... Fallback safely to the standard
 * version when an age-specific version is unavailable"). Deliberately
 * takes already-fetched strings, never calls out to anything at runtime -
 * every variant must already exist as a stored/localized content field
 * (see CultureItemRow.simple_summary) before this function ever runs.
 */
export function resolveContentByDepth(
  variants: Partial<Record<ContentDepth, string | null | undefined>>,
  depth: ContentDepth,
): string | null {
  const requested = variants[depth];
  if (requested) return requested;
  const standard = variants.standard;
  return standard ?? null;
}
